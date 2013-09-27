/*
 * This file contains all code representing
 * risk game on client side
 *
 * requires MooTool library's Object class
 */

/**
 * remove the first occurrence of 'element'
 * from 'array'. Compare by object identity(===).
 */
function removeFromArray(element, array) {
	for(var i=0; i<array.length; i++)
		if(element === array[i]) {
			array.splice(i,1);
			break;
		}
}

function Point2D(raw) {
    this.x = raw.x;
    this.y = raw.y;
}

function LineStrip(raw) {
	this.vertices = [];
	for(var i=0; i<raw.length; i++) {
		this.vertices.push(new Point2D(raw[i]));
	}
}

function Region(raw) {
    this.id = raw.id;
    this.name = raw.name;
    this.centerPos = new Point2D({
    	x:raw.centerX,
    	y:raw.centerY});
    this.textPos = new Point2D({
    	x:raw.textX,
    	y:raw.textY});
    this.vertices = new LineStrip(raw.vertices);
    this.connections = [];
    this.unresolvedConnectionIds = raw.connections; // Linked
    this.troops = null;
    this.owner = null;
    this.bonusCardType = raw.bonus;
    this.view = null; // Linked to RegionView object. breaks MVC.
}

function Continent(raw) {
    this.id = raw.id;
    this.name = raw.name;
    this.bonus = raw.bonus;
    this.color = raw.color;
    this.textPos = new Point2D({
    	x:raw.textX,
    	y:raw.textY});;
    
    // this regions array is compact, NOT associative
	this.regions = [];
    if(raw.regions != undefined) {
    	for(var i = 0; i < raw.regions.length ; i++) {
    		var region = new Region(raw.regions[i]);
    		region.continent = this;
    		this.regions.push(region);
    	}
    }
}

function User(name) {
    this.name = name;// google's nickname. serves as id as well.
}
User.neutralUser = new User('{neutral}');

function Player(raw, userById) {
	if(raw.user == undefined)
		this.user = User.neutralUser;
	else
		this.user = userById[raw.user];
    this.color = raw.color;
    this.numReinforcement = raw.reinforcement;
    this.ownedRegions = []; // Linked
    this.mission = null;
    this.unresolvedMissionId = raw.mission; // TODO (right now overwritten by default mission)
    this.numCards = raw.numCards;
    // the LI element that display status of this player
    // call this.updateStatusPanel() before first access
    this.statusPanel = null;
    this.detailDiv = null;
    this.nameDiv = null;
    
    // === functions
    
    /**
     * make the current player reinforce a particular region.
     */
    this.doReinforce = function(region, inc) {
    	this.numReinforcement -= inc;
    	region.troops += inc;
    	// update view
    	this.updateStatusPanel();
    	region.view.drawTroopData();
	};
	
	this.checkIfLost = function() {
		if(this.ownedRegions.length == 0) {
			// yes, remove him from activePlayerList
			for(var i=0; i<game.activePlayerList.length; i++) {
				if(game.activePlayerList[i] === this) {
					game.activePlayerList.splice(i,1);
					game.spectatorList.push(this.user);
					break;
				}
			}
			// update view
			game.constructStatusPanel();
		}
	};
	
	/**
	 * Check if the player is in game.activePlayerList
	 */
	this.isActive = function() {
		for(var i=0; i<game.activePlayerList.length; i++)
			if(game.activePlayerList[i] === this)
				return true;
		return false;
	};
	
	/**
	 * make this user discard the specified card.
	 */
	this.discard = function(card) {
		// if the card is already discarded, do nothing
		if(card.state == BonusCard.DISCARDED)
			return;
		this.numCards--;
		card.state = BonusCard.BonusCard.DISCARDED;
		game.cards.discarded.push(card);
		// check if this player is the client
		if(this.user === client.user) {
			// if so delete the card from the hand
			removeFromArray(card, client.bonusCards);
		}
		// update view
		this.updateStatusPanel();
	};
	
	this.getStatusPanelId = function() {
		return "statusPanel_"+this.user.name;
	};
	
	/**
	 * update status panel of this player to reflect current info.
	 * should be called when player's info change.
	 * 
	 * create the panel if never accessed before.
	 */
	this.updateStatusPanel = function() {
		// if doesn't exist yet
		if(this.statusPanel == null) {
			var idText = this.getStatusPanelId();
			var divPrefix = "div#"+idText;
			// create
			this.statusPanel = new Element("dt#"+idText);
			this.nameDiv = new Element(divPrefix+"_nameDiv");
			this.detailDiv = new Element(divPrefix+"_detailDiv");
			// nest
			this.statusPanel.grab(this.nameDiv);
			this.statusPanel.grab(this.detailDiv);
		}
		// set data
		this.nameDiv.setStyle('color',this.color);
		this.nameDiv.setStyle('font-family',"'terminal dosis', sans-serif");
		this.nameDiv.setStyle('font-size','18px');
		this.nameDiv.setProperty('text',this.user.name);
		this.nameDiv.setStyle('margin-left','10px');
		this.detailDiv.setProperty('text',
				'troops: '+this.numReinforcement
				+' / cards: '+this.numCards
				+' / regions: '+this.ownedRegions.length);
		this.detailDiv.setStyle('font-size','10px');
		this.detailDiv.setStyle('margin-left','20px');
	};
	
	/**
	 * Dirty expensive function to get
	 * bonus this player get by owning whole continents.
	 */
	this.getOwnedContinentBonus = function() {
		var bonus = 0;
		var continentKeys = Object.keys(game.map.continents);
		for(var i = 0 ; i < continentKeys.length ; i++) {
			var continent = game.map.continents[continentKeys[i]];
			var completelyOwn = true;
			var regionKeys = Object.keys(continent.regions);
			for(var j = 0 ; j < regionKeys.length ; j++) {
				var region = continent.regions[regionKeys[j]];
				if(region.owner !== this) {
					completelyOwn = false;
					break;
				}
			}
			//
			if(completelyOwn)
				bonus+=continent.bonus;
		}
		return bonus;
	};
	
}
// Define the neutral player
Player.neutralPlayer = new Player({
	color: '#C2C2C2',
	reinforcement: 0,
	ownedRegions: [], // Linked
	mission: null,
	bonusCards: []
});
Player.neutralPlayer.checkIfLost = function() {return false;};

// === begin representation of client
function Client(args) {
	if(args != undefined) {
		this.user = args.user;
		this.clientType = Client.clientType;
	}
}
Client.clientType = 0;
/**
 * create the correct type of client object
 * of a given user ID according to
 * what the role of this user ID is in
 * the global variable 'game'.
 */
Client.createFromGame = function(userId) {
	// get user object
	var user = game.userById[userId];
	if(user == undefined) {
		console.info("internal error: server sent client id that doesn't exist in game object");
		return null;
	}
	// get player object
	var player = game.playerListById[userId];
	if(player == undefined)
		// not a player
		return new Client({user:user});
	else {
		return new PlayerClient({
			user:user,
			player:player,
			bonusCards:[]});//TODO
	}
};
function PlayerClient(args) {
	Client.call(this, args);
	this.clientType = PlayerClient.clientType;
	if(args != undefined) {
		this.player = args.player;
		this.bonusCards = args.bonusCards;
	}
	
	/**
	 * put the specified to this PlayerClient's hand
	 */
	this.getCard = function(card) {
		if(card.state == BonusCard.DISCARDED) {
			removeFromArray(card, game.cards.discarded);
		}
		card.state = BonusCard.STATE_OWNEDBYCLIENT;
		this.bonusCards.push(card);
		this.player.numCards++;
		this.player.updateStatusPanel();
	};
}
PlayerClient.clientType = 1;
PlayerClient.prototype = new Client();
PlayerClient.prototype.constructor = PlayerClient;
// === end representation of client

function Trade() {
    this.cards = [];
}

function Map(raw) {
	this.id = raw.ID;
	
	this.name = raw.name;
	if(this.name == undefined)
		this.name = 'unnamed map';
	
	this.multiplier = raw.multiplier;
	if(this.multiplier == undefined)
		this.multiplier = 1;
	
	this.offsetX = raw.offsetX;
	if(this.offsetX == undefined)
		this.offsetX = 0;
	
	this.offsetY = raw.offsetY;
	if(this.offsetY == undefined)
		this.offsetY = 0;
	
	this.lines = [];
	if(raw.lines != undefined) {
		for(var i=0; i<raw.lines.length; i++)
			this.lines.push(new LineStrip(raw.lines[i]));
	}
	
	this.continents = {};
	if(raw.continents != undefined) {
		for(var i=0; i<raw.continents.length; i++) {
			var continent = new Continent(raw.continents[i]);
			if(continent.id != undefined)
				this.continents[continent.id] = continent;
		}
	}
	this.continentCount = raw.continents.length;
		
	// conclude a list of all regions
	// associative array by region id (well, it should be int anyway)
	this.regionCount = 0;
	this.regions = {};
	var continentKeys = Object.keys(this.continents);
	for(var i = 0 ; i < continentKeys.length ; i++) {
		var continent = this.continents[continentKeys[i]];
		var regionKeys = Object.keys(continent.regions);
		for(var j = 0 ; j < regionKeys.length ; j++) {
			var region = continent.regions[regionKeys[j]];
			this.regions[region.id] = region;
			this.regionCount++;
		}
	}
	
	// attempt to make proper links of connected regions
	this.linkRegion = function() {
		var regionKeys = Object.keys(this.regions);
		for(var i = 0 ; i < regionKeys.length ; i++) {
			var allResolved = true;
			var region = this.regions[regionKeys[i]];
			for(var j=0; j<region.unresolvedConnectionIds.length; j++) {
				var cid = region.unresolvedConnectionIds[j];
				var cr = this.regions[cid];
				if(cr != undefined) {
					region.connections.push(cr);
					delete region.unresolvedConnectionIds[j];
				}else {
					allResolved = false;
					console.info('unrecognised region id');
				}
			}
			if(allResolved)
				delete region.unresolvedConnectionIds;
		}
	};
	this.linkRegion();
	
}

function BonusCard(args) {
	if(args != undefined) {
		this.id = args.id;
		this.region = args.region; // null if not associated with a region
		this.state = args.state; // 1 -> owned by this PlayerClient; 2 -> Discarded; 3 -> either owned or in stack
		this.type = args.type; // -1,0 = joker; 1,2,3 each for the other 3 types ordered by value.
	}
}
BonusCard.TYPE_JOKER = 0;
BonusCard.STATE_OWNEDBYCLIENT = 1;
BonusCard.STATE_DISCARDED = 2;
BonusCard.STATE_STACKOROWNED = 3;


function Cards(args) {
	if(args == undefined)
		return;
	// make set of card hash
	this.cardsById = {};
	// joker cards
	this.cardsById[-1] = new BonusCard({
		id: -1,
		region: null,
		state: BonusCard.STATE_STACKOROWNED,
		type:BonusCard.TYPE_JOKER
	});
	this.cardsById[0] = new BonusCard({
		id: 0,
		region: null,
		state: BonusCard.STATE_STACKOROWNED,
		type:BonusCard.TYPE_JOKER
	});
	// cards associated with a region
	if(args.regions != undefined) {
		var regionKeys = Object.keys(args.regions);
		for(var i = 0 ; i < regionKeys.length ; i++) {
			var region = args.regions[regionKeys[i]];
			this.cardsById[region.id] = new BonusCard({
				id: region.id,
				region: region,
				state: BonusCard.STATE_STACKOROWNED,
				type: region.bonusCardType
			});
		}
	}
	// make discard pile
	if(args.discardPile != undefined) {
		this.discarded = [];
		for(var i = 0 ; i < args.discardPile.length ; i++) {
			var card = this.cardsById[args.discardPile[i]];
			this.discarded.push(card);
			card.state = BonusCard.STATE_DISCARDED;
		}
	}
}

function Temps() {
	this.changes = [];
	this.trade = [];
	this.reinforce = {};
	this.availableReinforce = -1;
	this.lastVictory = null;
}

/**
 * representing a single TYPE of mission card.
 * not representing an instance of the type.
 */
function MissionType(raw) {
	// id of the type of mission card
	this.typeId = raw.typeId;
	this.name = raw.name;
	/**
	 * A function(player) that returns true if
	 * the specified player has completed the mission.
	 */
	this.isComplete = raw.isComplete;
}

/**
 * represent an instance of mission card.
 */
function MissionCard(missionType, owner) {
	// id of the type of this instance of mission card.
	this.missionType = missionType;
	/**
	 * the player object that owns this card.
	 * null if the card is not owned.
	 */
	this.owner = owner;
	this.isComplete = function() {
		this.missionType.isComplete(this.owner);
	};
}

/**
 * represents the set of all mission cards
 */
function Missions(playerList) {
	this.types = {};
	this.types[0] = new MissionType({
		typeId: 0,
		name: 'neutral',
		isComplete: function(player) {
			return false;
		}});
	this.types[1] = new MissionType({
		typeId: 1,
		name: 'global conquest',
		isComplete: function(player) {
			return (player.ownedRegions.length == game.map.regionCount)
				|| (game.activePlayerList.length == 1 && player === game.activePlayerList[0]);
		}});
	// the instances of cards
	this.missionCards = [];
	this.missionCards.push(Player.neutralPlayer.mission = new MissionCard(this.types[0], Player.neutralPlayer));
	for(var i=0; i<playerList.length; i++) {
		var player = playerList[i];
		this.missionCards.push(player.mission = new MissionCard(this.types[1], player));
	}
	
}

function Game(raw) {
	// defaulting values
	this.id = raw.ID;
	this.userById = {};
	this.playerListById = {};
    this.playerList = [];
    this.activePlayerList = [];
    this.spectatorList = [];
    this.map = null;
    this.round = 0;
    this.time = 0;
    this.gameStates = new GameStates();
    this.currentState = null;
    this.temps = new Temps();
    this.missions = null;
    this.winner = null; // TODO have Shane store it?
	
	// parsing raw_Map
	this.map = new Map(raw.map);
	
	// parse & create user look up
	// also create spectator list
	for(var i=0; i<raw.spectators.length; i++) {
		var user = new User(raw.spectators[i]);
		this.userById[user.name] = user;
		this.spectatorList.push(user);
	}
	for(var i=0; i<raw.playingOrder.length; i++) {
		var user = new User(raw.playingOrder[i]);
		this.userById[user.name] = user;
	}
	
	// create player look up & populate player list
	for(var i=0; i<raw.players.length; i++) {
		var player = new Player(raw.players[i], this.userById);
		this.playerListById[player.user.name] = player;
		this.playerList.push(player);
	}
	// put neutral in the look up, but not in other list
	this.playerListById[Player.neutralPlayer.user.name] = Player.neutralPlayer;
	this.playerListById[null] = Player.neutralPlayer;
	
	// get the turn order store it orderly in activePlayerList
	for(var i=0; i<raw.playingOrder.length; i++) {
		var player = this.playerListById[raw.playingOrder[i]];
		this.activePlayerList.push(player);
	}
	
	// this assign dummy mission cards to everybody without looking at the raw
	this.missions = new Missions(this.playerList);
	
	// linking region owner
	for(var i = 0 ; i < raw.map.regions.length ; i++) {
		var raw_region = raw.map.regions[i];
		var region = this.map.regions[raw_region.regionID];
		var owner;
		if(raw_region.owner == null)
			owner = Player.neutralPlayer;
		else
			owner = this.playerListById[raw_region.owner];
		region.troops = raw_region.troops;
		region.owner = owner;
		owner.ownedRegions.push(region);
	}
	
	// parsing raw_GameCards
	this.cards = new Cards({regions:this.map.regions, discardPile:raw.discardPile});
	
	// parsing raw_Game
	this.time = raw.time;
	this.round = raw.round_number;
	this.currentPlayer = this.playerListById[raw.currentPlayer];
	this.currentState = this.gameStates.states[raw.currentState];
	
	// === end of parsing
	// === begin functions
	
	// Get the turn order number of a specified player object
	// Return null if the player is not found in active player list.
	this.getTurnOrderNumber = function(player) {
		for(var i=0; i<this.activePlayerList.length; i++) {
			if(player === this.activePlayerList[i])
				return i;
		}
		return null;
	};
	
	/**
	 * get the next player in the turn order.
	 */
	this.getNextPlayer = function() {
		var curTurn = this.getTurnOrderNumber(this.currentPlayer);
		curTurn++;
		if(curTurn > this.activePlayerList.length - 1)
			curTurn = 0;
		return this.activePlayerList[curTurn];
	};
	
	/**
	 * Get the next player in turn order from the current player
	 * who has some reinforcement remaining.
	 * If every player doesn't have any reinforcement left,
	 * return null.
	 */
	this.getNextPlayerWithReinforcement = function() {
		var curTurn = this.getTurnOrderNumber(this.currentPlayer);
		var t;
		for(t=curTurn+1; t<this.activePlayerList.length; t++)
			if(this.activePlayerList[t].numReinforcement > 0)
				return this.activePlayerList[t];
		for(t=0; t<=curTurn; t++)
			if(this.activePlayerList[t].numReinforcement > 0)
				return this.activePlayerList[t];
		return null;
	};
	
	// In distribution phase, distribute 1 troop of the current player
	// into the specified region and change current player OR move to reinforcement phase
	this.distribute = function(regionId) {
		var region = this.map.regions[regionId];
		region.troops++;
		this.currentPlayer.numReinforcement--;
		region.view.drawTroopData();
		this.currentPlayer.updateStatusPanel();
		
		// find the currentPlayer in the turn order
		this.currentPlayer = this.getNextPlayerWithReinforcement();
		if(this.currentPlayer == null) {
			console.info('state change detected');
			this.currentPlayer = this.activePlayerList[0];
			this.changeState(GFS_P_Reinforce);
		} else {
			this.updateStateHeading();
		}
	};
	
	this.updateStateHeading = function() {
		if(client instanceof PlayerClient && this.currentPlayer === client.player)
			View.setStateHeading("your "+this.currentState.name);
		else
			View.setStateHeading(this.currentPlayer.user.name+"'s "+this.currentState.name);
	};
	
	/**
	 * change the state of the game from currentState
	 * to a given destination state.
	 * This function is implemented to provide a centralised place
	 * to observe the change in game state.
	 * 
	 * current player must be changed before this.
	 * TODO kinda messed up.
	 */
	this.changeState = function(destinationState) {
		
		// if the state doesn't actually change, do nothing
		if(this.currentState === destinationState)
			return;
		
		// listens for round number change
		if(this.currentState instanceof GFS_SettingUp
				&& destinationState instanceof GFS_Playing)
			this.round = 1;
		if(this.currentState instanceof GFS_P_Redeploy
				&& destinationState instanceof GFS_P_Attack)
			this.round++;
		
		// TODO state change observer code here.
		
		this.currentState = this.gameStates.states[destinationState.id];
		
		// if entering reinforcement phase, calculate increment to reinforcement
		if(this.currentState instanceof GFS_P_Reinforce)
			this.currentPlayer.numReinforcement += Math.max(
					3,
					Math.floor(this.currentPlayer.ownedRegions.length/3)
					+this.currentPlayer.getOwnedContinentBonus());
		
		// change labels
		if(this.currentState instanceof GFS_End)
			View.setStateHeading(this.winner.user.name+" won");
		else
			this.updateStateHeading();
	};
	
	/**
	 * Dynamically create panel to display
	 * players' status inside $("statuses")
	 * replacing the old content of that.
	 * 
	 * Only display active players.
	 * should be called when number of player changes.
	 */
	this.constructStatusPanel = function() {
		var statuesPanel = $("statuses");
		// clear old content
		statuesPanel.empty();
		for(var i=0; i<this.activePlayerList.length; i++) {
			var player = this.activePlayerList[i];
			if( player instanceof Player ) {
				player.updateStatusPanel();
				statuesPanel.grab(player.statusPanel);
			}			
		}
	};
	
	/**
	 * update $("statuses") to show the active players' info.
	 * should be called when player's info change.
	 */
	this.updateStatusPanel = function() {
		for(var i=0; i<this.activePlayerList.length; i++) {
			var player = this.activePlayerList[i];
			player.updateStatusPanel();
		}
	};
}