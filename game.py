from google.appengine.api import channel, users
from google.appengine.ext import db
from google.appengine.ext.webapp import template
from google.appengine.ext.webapp.util import run_wsgi_app

import os
import webapp2
import json
import random
import logging
import urllib
import math

import database

class AddListener(webapp2.RequestHandler):
    def post(self):
        #clientID = self.request.get('from')
        pass

class RemoveListener(webapp2.RequestHandler):
    def post(self):
        clientID = self.request.get('from')
        client = database.Client.get_by_id(int(clientID))
        if client:
            #client.delete()
            pass
        
class Chat(webapp2.RequestHandler):
    def post(self):
        message = self.request.get('message')
        query = db.GqlQuery("SELECT __key__ FROM Client WHERE screen = :1", self.request.get('screen'))
        for client in query:
            channel.send_message(str(client.id()), message)

def createGameEvent(props, game):
    game.time = game.time + 1
    
    if props['gameEventType'] == 1:
        startIndex = game.currentPlayerIndex
        size = len(game.playingOrder)
        currentIndex = (startIndex + 1) % size
        nextPlayer = None
        while not (currentIndex == startIndex):
            player = database.GamePlayers.getPlayer(game, currentIndex)
            if player.reinforcement > 0:
                nextPlayer = player
                break
            currentIndex = (currentIndex + 1) % size
        else:
            player = database.GamePlayers.getPlayer(game, currentIndex)
            if player.reinforcement > 0:
                nextPlayer = player
                
        logging.info(player.user.nickname())
                
        if nextPlayer:
            game.currentPlayer = nextPlayer.user
            game.currentPlayerIndex = currentIndex
        else:
            game.round_number = 1
            game.currentState = 2
            game.currentPlayer = database.GamePlayers.getPlayer(game, 0).user
            game.currentPlayerIndex = 0
    elif props['gameEventType'] == 2:
        game.currentState = 3
    elif props['gameEventType'] == 3:
        if game.lastVictory:
            if len(game.playingOrder) == 1:
                game.currentState = 5
    elif props['gameEventType'] == 5:
        game.currentState = 4
    elif props['gameEventType'] == 6:
        game.currentState = 2
        game.currentPlayerIndex = (game.currentPlayerIndex + 1) % len(game.playingOrder)
        game.currentPlayer = database.GamePlayers.getPlayer(game, game.currentPlayerIndex).user
        game.round_number = game.round_number + 1
    
    game.put()
    return dict({'messageType':3, 'gameId':game.key().id(), 'time':game.time}.items() + props.items())
            
def broadcastGameEvent(eventProps, game):
    secret = None
    gameEvent = createGameEvent(eventProps, game)
    if gameEvent['gameEventType'] == 5 and gameEvent['cardId']:
        secret = dict.copy(gameEvent)
        secret['cardId'] = -2
        secret = json.dumps(secret)
    
    broadcastMessage(json.dumps(gameEvent), str(game.key().id()), secret)
        
def broadcastMessage(message, screen, secret=None):
    if secret:
        for client in db.GqlQuery("SELECT * FROM Client WHERE screen = :1", screen):
            if client.user == users.get_current_user():
                channel.send_message(client.key().id().__str__(), message)
            else:
                channel.send_message(client.key().id().__str__(), secret)
    else:
        for client in db.GqlQuery("SELECT __key__ FROM Client WHERE screen = :1", screen):
            channel.send_message(client.id().__str__(), message)

class GameAction(webapp2.RequestHandler):
    def post(self):
        action = self.request.get('action')
        action = json.loads(urllib.unquote(action))
        
        logging.info(action)
        
        error = ""
        game = database.Game.get_by_id(action['gameId'])
        
        user = users.get_current_user()
        if not user:
            self.redirect(users.create_login_url(self.request.uri))
            return
        elif not (user == game.currentPlayer):
            self.response.write("WRONG USER")
            return
        
        if not (action['time'] == game.time):
            error = error + "Time does not match.\n"
        elif action['gameActionType'] == 1: # GA_Distributed
            gameRegion = db.GqlQuery("SELECT * FROM GameRegions WHERE regionID = :1 AND game = :2", action['region'], game).get()
            if gameRegion:
                if gameRegion.owner == user:
                    player = database.GamePlayers.getPlayer(game, game.currentPlayerIndex)
                    player.reinforcement = player.reinforcement - 1
                    player.put()
                    gameRegion.troops = gameRegion.troops + 1
                    gameRegion.put()
                    broadcastGameEvent({'gameEventType':1, 'region':action['region']}, game)
                else:
                    error = error + "Region '" + str(action['region']) + "' belongs to another user.\n"
            else :
                database.GameRegions(game=game, regionID=action['region'], troops=1, owner=user).put()
                broadcastGameEvent({'gameEventType':1, 'region':action['region']}, game)
        elif action['gameActionType'] == 2: # GA_Reinforce
            consistent = True
            
            gameCards = []
            bonusCards = []
            bonus = 0
            if len(action['trade']) == 3:
                for card in action['trade']:
                    gameCard = db.GqlQuery("SELECT * FROM GameCards WHERE cardRef = :1 AND game = :2", card, game).get()
                    gameCards.push(gameCard)
                    bonusCards.push(gameCard.bonus)
                    if (not gameCard):
                        consistent = False
                        error = error + "Card '" + str(card) + "' does not exist in this game.\n"
                    elif (not (gameCard.state == 1)):
                        consistent = False
                        error = error + "Card '" + str(card) + "' is not owned by any user in this game.\n"
                    elif gameCard.owner != user:
                        consistent = False
                        error = error + "Card '" + str(card) + "' is not owned by this user.\n"
                    else:
                        gameCard.owner = None
                        gameCard.state = 2
                uniqueCardSet = sorted(set(bonusCards))
                uniqueCards = len(uniqueCardSet)
                if uniqueCards == 3:
                    bonus = 10
                elif uniqueCards == 1:
                    bonus = 2 + 2 * uniqueCardSet[0]
                elif uniqueCards == 2 and uniqueCardSet[0] < 1 and uniqueCardSet[1] > 0:
                    bonus = 2 + 2 * uniqueCardSet[1]
                else:
                    consistent = False
                    error = error + "This combination of cards cannot be traded.\n"
            elif len(action['trade']) == 0:
                pass
            else:
                consistent = False
                error = error + "Incorrect number of cards to trade.\n"
                
            continentBonus = 0
            
            regions = db.GqlQuery("SELECT * FROM GameRegions WHERE game = :1 AND owner = :2", game, user).fetch(1000)
            regionCount = len(regions)
            
            regionIDs = []
            
            for region in regions:
                regionIDs.append(int(region.regionID))
            
            regionIDs = set(regionIDs)
            
            continentData = json.loads(game.map.continentData)
            for continent in continentData:
                if set(continent['IDs']) <= regionIDs:
                    continentBonus = continentBonus + continent['bonus']
            
            reinforceTotal = 0
            
            gameRegions = []
            player = db.GqlQuery("SELECT * FROM GamePlayers WHERE user = :1 AND game = :2", user, game).get()
            player.reinforcement = player.reinforcement + bonus + int(max(3, math.floor(regionCount/3))) + continentBonus
            
            for reinforce in action['reinforce']:
                gameRegion = db.GqlQuery("SELECT * FROM GameRegions WHERE regionID = :1 AND game = :2", int(reinforce[0]), game).get()
                if gameRegion:
                    if gameRegion.owner == user:
                        gameRegion.troops = gameRegion.troops + reinforce[1]
                        reinforceTotal = reinforceTotal + reinforce[1]
                        gameRegions.append(gameRegion)
                    else:
                        consistent = False
                        error = error + "Region '" + reinforce[0] + "' belongs to another user.\n"
                else:
                    consistent = False
                    error = error + "Region '" + reinforce[0] + "' does not exist.\n"
            if reinforceTotal > player.reinforcement:
                consistent = False
                error = error + "Player does not have enough troops.\n"

            if consistent:
                player.reinforcement = player.reinforcement - reinforceTotal
                player.put()
                for region in gameRegions:
                    region.put()
                for card in gameCards:
                    card.put()
                
                broadcastGameEvent({'gameEventType':2, 'reinforce':action['reinforce'], 'trade':action['trade']}, game)
        elif action['gameActionType'] == 3: # GA_Attack
            if not (int(action['regionDes']) in json.loads(game.map.regionData)[str(action['regionSrc'])]['connections']):
                error = error + "Region '" + str(action['regionSrc']) + "' cannot attack region '" + str(action['regionDes']) + "'.\n"
            else :
                source = db.GqlQuery("SELECT * FROM GameRegions WHERE regionID = :1 AND game = :2", action['regionSrc'], game).get()
                dest = db.GqlQuery("SELECT * FROM GameRegions WHERE regionID = :1 AND game = :2", action['regionDes'], game).get()
                if not source:
                    error = error + "Region '" + str(action['regionSrc']) + "' doesn't exist in this map.\n"
                elif not dest:
                    error = error + "Region '" + str(action['regionDes']) + "' doesn't exist in this map.\n"
                elif not source.owner == user:
                    error = error + "Source Region '" + str(action['regionSrc']) + "' is not owned by this user.\n"
                elif dest.owner == user:
                    error = error + "Destination Region '" + str(action['regionDes']) + "' is owned by this user.\n"
                elif source.troops < 2:
                    error = error + "Source Region '" + str(action['regionDes']) + "' has too few troops to initiate an attack.\n"
                else:
                    sourceTroops = source.troops
                    destTroops = dest.troops
                    attackingForce = min(3, sourceTroops - 1)
                    defendingForce = min(attackingForce, min(2, destTroops))
                    attackRoll = []
                    defendRoll = []
                    for i in range(attackingForce):
                        attackRoll.append(random.randint(1, 6))
                    for i in range(defendingForce):
                        defendRoll.append(random.randint(1, 6))
                        
                    attackRoll = sorted(attackRoll)
                    defendRoll = sorted(defendRoll)
                    
                    attackChange = 0
                    defendChange = 0
                    
                    while not (len(defendRoll) == 0):
                        attack = attackRoll.pop()
                        defend = defendRoll.pop()
                        if attack > defend:
                            defendChange = defendChange - 1
                        else:
                            attackChange = attackChange - 1
                            
                    dest.troops = dest.troops + defendChange
                    source.troops = source.troops + attackChange
                    
                    changeSrc = attackChange
                    changeDes = defendChange
                    
                    if dest.troops == 0:
                        loser = db.GqlQuery("SELECT * FROM GamePlayers WHERE user = :1 AND game = :2", dest.owner, game).get()
                        dest.troops = attackingForce + attackChange
                        source.troops = source.troops - attackingForce
                        dest.owner = user
                        game.lastVictory = json.dumps({'user':user.nickname(), 'source':source.key().id(), 'dest':dest.key().id()})
                        if database.GamePlayers.isActive(game, loser) == 0:
                            loserID = loser.key().id()
                            for i in range(len(game.playingOrder)):
                                player = json.loads(game.playingOrder[i])
                                if player.index == loserID:
                                    game.playingOrder.pop(i)
                                    if i < game.currentPlayerIndex:
                                        game.currentPlayerIndex = game.currentPlayerIndex - 1
                                    return
                        game.put()
                        
                    dest.put()
                    source.put()
                    broadcastGameEvent({'gameEventType':3, 'regionSrc':action['regionSrc'], 'regionDes':action['regionDes'], 'changeSrc':changeSrc, 'changeDes':changeDes}, game)
        elif action['gameActionType'] == 4: # GA_DistributeAfterConquest
            lastVictory = json.loads(game.lastVictory)
            if not (lastVictory['user'] == user.nickname()):
                error = error + "GameAction sent from wrong user.\n"
            else:
                source = database.GameRegions.get_by_id(lastVictory['source'])
                dest = database.GameRegions.get_by_id(lastVictory['dest'])
                if not (action['extraTroops'] < source.troops):
                    error = error + "Region '" + source.regionID + "' cannot support the transfer.\n"
                else:
                    source.troops = source.troops - action['extraTroops']
                    dest.troops = dest.troops + action['extraTroops']
                    dest.put()
                    source.put()
                    game.put()
                    broadcastGameEvent({'gameEventType':4, 'regionSrc':source.regionID, 'regionDes':dest.regionID, 'troopSrc':source.troops, 'troopDes':dest.troops}, game)
        elif action['gameActionType'] == 5: # GA_Attacked
            card = None
            if game.lastVictory:
                card = database.GameCards.pickRandomCard(game).cardRef
                game.lastVictory = None
                game.put()
            broadcastGameEvent({'gameEventType':5, 'cardId':card}, game)
        elif action['gameActionType'] == 6: # GA_Redeployed
            consistent = True
            gameRegions = []
            for change in action['changes']:
                source = db.GqlQuery("SELECT * FROM GameRegions WHERE regionID = :1 AND game = :2", change[0], game).get()
                dest = db.GqlQuery("SELECT * FROM GameRegions WHERE regionID = :1 AND game = :2", change[1], game).get()
                    
                if not source:
                    consistent = False
                    error = error + "Region '" + change[0] + "' doesn't exist in this map.\n"
                elif not dest:
                    consistent = False
                    error = error + "Region '" + change[1] + "' doesn't exist in this map.\n"
                elif not (source.troops > change[2]):
                    consistent = False
                    error = error + "Region '" + change[0] + "' cannot support the transfer.\n"
                elif not (source.owner == user == dest.owner):
                    consistent = False 
                    error = error + "Region '" + change[0] + "' cannot support the transfer.\n"
                else:
                    dest.troops = dest.troops + int(change[2])
                    source.troops = source.troops - int(change[2])
                    gameRegions.append(dest)
                    gameRegions.append(source)
            if consistent:
                for region in gameRegions:
                    region.put()
                broadcastGameEvent({'gameEventType':6, 'changes':action['changes']}, game)
        self.response.write(error)
            
class RenewToken(webapp2.RequestHandler):
    def post(self):
        clientID = self.request.get('clientID')
        savedUser = database.Client.get_by_id(int(clientID)).user.nickname()
        user = users.get_current_user().nickname()
        
        if user == savedUser:
            self.response.out.write(database.Client.createChannel(clientID))
        else:
            self.response.out.write("error")
            
class GetGame(webapp2.RequestHandler):
    def get(self, gameID):
        user = users.get_current_user()
        if not user:
            self.redirect(users.create_login_url(self.request.uri))
            return
        
        game = database.Game.get_by_id(int(gameID))
                
        if game:
            screen = game.key().id().__str__()
            client = database.Client.create(user, screen, 2)
            clientID = str(client.key().id())
                
            props = {
                'gameID': game.key().id(),
                'isCreator': "false",
                'screen': screen,
                'token': database.Client.createChannel(clientID),
                'clientID': clientID
            }
            
            if game.currentState > 0:
                client.screenType = 2
                client.put()
                path = os.path.join(os.path.dirname(__file__), 'game_template.html')
            else:                
                path = os.path.join(os.path.dirname(__file__), 'waiting_room_template.html')
                if game.creator == user:
                    props['isCreator'] = "true"
                elif db.GqlQuery("SELECT __key__ FROM GamePlayers WHERE game = :1 AND user = :2", game, user).get():
                    pass
                elif db.GqlQuery("SELECT __key__ FROM GamePlayers WHERE game = :1", game).count() < 6:
                    database.GamePlayers(game=game, user=user, color=game.colors.pop(), isPlaying=True).put()
                    broadcastMessage("refresh", screen)
                    game.put()
                else:
                    database.GameSpectators(game=game, user=user).put()

            self.response.write(template.render(path, props))
        else :
            self.response.write("NO SUCH GAME")
            
class StartGame(webapp2.RequestHandler):
    def post(self, gameID):
        user = users.get_current_user()
        if not user:
            self.response.write("NOT LOGGED IN")
            return            
        
        game = database.Game.get_by_id(int(gameID))
        if not game:
            self.response.write("GAME NOT FOUND")
            return
        elif not (user == game.creator):
            self.response.write("Wrong User")
            return
        
        game.currentState = 1
        game.round_number = 0
        game.time = 0
        
        game.playingOrder = []
        for player in game.players:
            game.playingOrder.append(json.dumps({'index': player.key().id(), 'userID':player.user.nickname()}));
        
        random.shuffle(game.playingOrder)
        
        regions = db.GqlQuery("SELECT * FROM GameRegions WHERE game = :1", game).fetch(1000)
        random.shuffle(regions)
        
        players = db.GqlQuery("SELECT * FROM GamePlayers WHERE game = :1", game).fetch(1000)
        length = len(players)
        hasNuetral = False
        if length == 2:
            hasNuetral = True
            length = 3
            
        regionsLength = len(regions)
        for player in players:
            player.reinforcement = 50 - 5 * length
            for i in range(regionsLength / length):
                region = regions.pop()
                region.troops = 1
                region.owner = player.user
                region.put()
            player.put()
        
        random.shuffle(players)
        
        for i in range(len(regions)):
            region = regions.pop()
            if not hasNuetral:
                region.troops = 1
                region.owner = players.pop().user
            else:
                region.troops = 2
                region.owner = None
            region.put()
        
        game.currentPlayer = database.GamePlayers.getPlayer(game, 0).user
        game.currentPlayerIndex = 0
        game.put()
        broadcastMessage("start", str(game.key().id()))
        self.response.write("OK")

class CreateGame(webapp2.RequestHandler):
    def get(self):
        user = users.get_current_user()
        if not user:
            self.redirect(users.create_login_url(self.request.uri))
            return
        
        game = database.Game.create(database.Map.all().get(), user)
        self.redirect("/game/" + str(game.key().id()))
        
class RetrievePlayers(webapp2.RequestHandler):
    def post(self, gameID):
        players = []
        for player in db.GqlQuery("SELECT * FROM GamePlayers WHERE game = :1", database.Game.get_by_id(int(gameID))):
            players.append({'player' : player.user.nickname(), 'color' : player.color})
        self.response.write(json.dumps(players))
    
def getGamePlayers(game):
    players = []
    for player in game.players:
        players.append({
                        'user': player.user.nickname(),
                        'color': player.color,
                        'isPlaying': player.isPlaying,
                        'reinforcement': player.reinforcement,
                        'mission': player.mission,
                        'numCards': db.GqlQuery("SELECT __key__ FROM GameCards WHERE owner = :1 AND game = :2", player.user, game).count()
        });
        
    return players

def getGameSpectators(game):
    spectators = []
    for spectator in game.spectators:
        spectators.append(spectator.user.nickname());
        
    return spectators

def getGameRegions(game):
    regions = []
    for region in game.regions:
        regions.append({
                        'regionID': region.regionID,
                        'troops': region.troops,
                        'owner': region.owner.nickname() if region.owner else None
        });
        
    return regions

def getGameCards(game):
    cards = []
    for card in db.GqlQuery("SELECT * FROM GameCards WHERE owner = :1 AND game = :2", users.get_current_user(), game):
        cards.append(card.cardRef)
        
    return cards

def getDiscardPile(game):
    cards = []
    for card in db.GqlQuery("SELECT * FROM GameCards WHERE state = :1 AND game = :2", 2, game):
        cards.push(card.cardRef)
        
    return cards

def getMissionCards():
    cards = []
    for card in database.MissionCard.all():
        cards.append({
            'name': card.name,
            'description': cards.description
        });
        
    return cards

def getPlayingOrder(game):
    playingOrder = []
    for i in range(len(game.playingOrder)):
        playingOrder.append(json.loads(game.playingOrder[i])["userID"])
    return playingOrder
            
class GetGameClientJS(webapp2.RequestHandler):
    def get(self, gameID):
        templateFile = os.path.join(os.path.dirname(__file__), 'GameClient_template.js')
        game = database.Game.get_by_id(int(gameID))
        user = users.get_current_user()
        
        if game:
            if not user:
                self.response.write("NO LOGGED IN")
                return                
            
            screen = gameID
            client = database.Client.create(user, screen, 2)
            clientID = str(client.key().id())
            values = {
                'username': user.nickname(),
                'screen': screen,
                'token': database.Client.createChannel(clientID),
                'clientID': clientID
            }
        
            gameObject = {
                'ID' : int(gameID),
                'time' : game.time,
                'round_number' : game.round_number,
                'currentState' : game.currentState,
                'currentPlayer' : game.currentPlayer.nickname() if game.currentPlayer else None,
                'players' : getGamePlayers(game),
                'spectators' : getGameSpectators(game),
                'cards' : getGameCards(game),
                'discardPile' : getDiscardPile(game),
                'playingOrder' : getPlayingOrder(game),
                'map' : json.loads(game.map.json)
            }
            
            gameObject['map']['ID'] = game.map.key().id()
            gameObject['map']['name'] = game.map.name
            gameObject['map']['missions'] = getMissionCards()
            gameObject['map']['regions'] = getGameRegions(game)
            
            values['data'] = json.dumps(gameObject);

            output = template.render(templateFile, values)
            self.response.headers["content-type"] = "text/javascript"
            self.response.write(output)                
        else :
            self.response.write("NO SUCH GAME")
            

# Stores the map data for the default map
import sample_map

# If no map is defined then create the default map
if not database.Map.all().get():  
    database.Map.create(sample_map.data)

app = webapp2.WSGIApplication(
                                [
                                    ('/', CreateGame),
                                    ('/chat', Chat),
                                    ('/gameAction', GameAction),
                                    ('/renewToken', RenewToken),
                                    (r'/game/(\d+)', GetGame),
                                    (r'/startGame/(\d+)', StartGame),
                                    (r'/getPlayers/(\d+)', RetrievePlayers),
                                    (r'/GameClient/(\d+)', GetGameClientJS),
                                    ('/_ah/channel/connected/', AddListener),
                                    ('/_ah/channel/disconnected/', RemoveListener),
                                ], debug=True)

def main():run_wsgi_app(app)
if __name__ == "__main__":main()
