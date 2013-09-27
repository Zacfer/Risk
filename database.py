from google.appengine.api import channel, users
from google.appengine.ext import db

import random
import json

random.seed()

class Callable:
    def __init__(self, anycallable):
        self.__call__ = anycallable
        
def createMap(mapData):
    regionData = {}
    continentData = []
    for continent in mapData['continents']:
        regionIDs = []    
        for region in continent['regions']:
            regionIDs.append(int(region['id']))
            regionData[str(region['id'])] = {'connections' : region['connections'], 'bonus' : region['bonus']}
            
        continentData.append({'IDs':regionIDs, 'bonus': continent['bonus']})
                
    regionData['0'] = {
                    'connections':[],
                    'bonus':0
                }
    regionData['-1'] = {
                    'connections':[],
                    'bonus':-1
                }
                
    Map(name = "World Map", json = json.dumps(mapData), regionData = json.dumps(regionData), continentData = json.dumps(continentData)).put()

class MissionCard(db.Model):
    name = db.StringProperty()
    description = db.StringProperty()
    
class Map(db.Model):
    name = db.StringProperty()
    json = db.TextProperty()
    regionData = db.TextProperty()
    continentData = db.TextProperty()
    create = Callable(createMap)
    
def createGame(map, user):
    game = Game(map=map, currentState=0)
    game.creator = user
    game.put()
    random.shuffle(game.colors)
    
    regionData = json.loads(map.regionData).items()
    length = len(regionData)
    rand = range(length)
    random.shuffle(rand)
    for i in range(length):
        region = regionData[i]
        regionID = int(region[0])
        if regionID > 0:
            GameRegions(game=game, regionID=regionID).put()
        GameCards(game=game, cardRef=regionID, bonus=region[1]["bonus"], state=0, random=rand[i]).put()
        
    GamePlayers(game=game, user=user, color=game.colors.pop(), isPlaying=True).put()
    game.put()
    return game

class Game(db.Model):
    map = db.ReferenceProperty(Map)
    time = db.IntegerProperty()
    round_number = db.IntegerProperty()
    currentState = db.IntegerProperty()
    currentPlayer = db.UserProperty()
    currentPlayerIndex = db.IntegerProperty()
    lastVictory = db.TextProperty()
    playingOrder = db.StringListProperty()
    #colors = db.StringListProperty(default=["#E502B0", "#E51B1B", "#0149EB", "#9500FF", "#2FDD30", "#FF6B00"])
    colors = db.StringListProperty(default=["#FF2300", "#1142AA", "#FF9F00", "#00BD39", "#872277", "#3AAACF"])
    creator = db.UserProperty()
    create = Callable(createGame)

def replenishDeck(game):
    query = db.GqlQuery("SELECT * FROM GameCards WHERE game = :2 AND state = :1", 2, game).fetch(1000)
    length = len(query)
    
    rand = range(length)
    random.shuffle(rand)
    
    for i in range(length):
        query[i].random = rand[i]
        query[i].state = 0
        query[i].put()

def isActive(game, player):
    if not player:
        return True
    else:
        return db.GqlQuery("SELECT __key__ FROM GameRegions WHERE owner = :1 AND game = :2", player.user, game).count()

def getPlayer(game, index):
    playerJSON = json.loads(game.playingOrder[index])
    return GamePlayers.get_by_id(playerJSON["index"])

class GamePlayers(db.Model):
    game = db.ReferenceProperty(Game, collection_name="players")
    user = db.UserProperty()
    color = db.StringProperty()
    isPlaying = db.BooleanProperty()    # 0 -> Inactive ; 1 -> Active
    reinforcement = db.IntegerProperty()
    mission = db.ReferenceProperty(MissionCard)
    isActive = Callable(isActive)
    getPlayer = Callable(getPlayer)
    
class GameSpectators(db.Model):
    game = db.ReferenceProperty(Game, collection_name="spectators")
    user = db.UserProperty()
    
class GameRegions(db.Model):
    game = db.ReferenceProperty(Game, collection_name="regions")
    regionID = db.IntegerProperty() # ID of the Region
    troops = db.IntegerProperty()
    owner = db.UserProperty()
    
def getRandomCard(game):
    card = db.GqlQuery("SELECT * FROM GameCards WHERE game = :2 AND state = :1 ORDER BY random DESC", 0, game).get()
    if card:
        card.state = 1
        card.owner = users.GetCurrentUser()
        card.put()
        return card
    else:
        replenishDeck(game)
        return getRandomCard(game)

class GameCards(db.Model):
    game = db.ReferenceProperty(Game, collection_name="cards")
    cardRef = db.IntegerProperty() # ID of the Region ; 0, -1 stores Joker
    bonus = db.IntegerProperty()
    state = db.IntegerProperty()    # 0 -> Stack ; 1 -> Owned ; 2 -> Discarded
    owner = db.UserProperty()
    random = db.IntegerProperty()
    pickRandomCard = Callable(getRandomCard)

def createClient(user, screen, screenType):
    client = Client(user=user, screen=screen, screenType=screenType)
    client.put()
    return client

def createChannel(clientID):
    return channel.create_channel(clientID)

class Client(db.Model):
    user = db.UserProperty()
    screen = db.StringProperty()
    screenType = db.IntegerProperty() # 0 -> Lobby ; 1 -> WR ; 2 -> Game
    game = db.ReferenceProperty(Game)
    create = Callable(createClient)
    createChannel = Callable(createChannel)