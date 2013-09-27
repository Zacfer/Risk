/**
 * super class of all game actions
 * 
 * Game actions are message from client to server
 * telling the server what a player has decided.
 * The server must not trust the validity of this message.
 * If the message is valid though,
 * the server will process the player's choice
 * and probably broadcast its result with "GameEvent" message.
 */
function GameAction() {
	if(window.game == undefined)
		GameMessage.call(this);
	else
		// assuming that there is a global variable 'game' on client side.
		// any game action created from this client will have have game ID and game time
		// set as follow
		GameMessage.call(this, game.id, game.time);
	// typeID = 0 for abstract game event class
	this.gameActionType = GameAction.gameActionType;
}
GameAction.gameActionType = 0;
GameAction.prototype = new GameMessage();
GameAction.prototype.constructor = GameAction;

/**
 * Tell server that the current user decided to
 * distribute 1 more troop into the specified region
 * during distribution phase.
 */
function GA_Distributed(region) {
	GameAction.call(this);
	this.gameActionType = GA_Distributed.gameActionType;
	this.region = region;
}
GA_Distributed.gameActionType = 1;
GA_Distributed.prototype = new GameAction();
GA_Distributed.prototype.constructor = GA_Distributed;

/**
 * Tell the server the current player's
 * decision on his reinforcement phase.

 * @param trade
 * 	= [tradedCard1, tradedCard2, ...]
 * @param reinforce
 *  = [ [region1 increment1] [region2 increment2] ... ]
 */
function GA_Reinforce(trade, reinforce) {
	GameAction.call(this);
	this.gameActionType = GA_Reinforce.gameActionType;
	this.trade = trade;
	this.reinforce = reinforce;
}
GA_Reinforce.gameActionType = 2;
GA_Reinforce.prototype = new GameAction();
GA_Reinforce.prototype.constructor = GA_Reinforce;

/**
 * Tell the server that the current player
 * decide to use region 'regionSrc'
 * to attack region 'regionDes'
 */
function GA_Attack(regionSrc, regionDes) {
	GameAction.call(this);
	this.gameActionType = GA_Attack.gameActionType;
	this.regionSrc = regionSrc;
	this.regionDes = regionDes;
}
GA_Attack.gameActionType = 3;
GA_Attack.prototype = new GameAction();
GA_Attack.prototype.constructor = GA_Attack;

/**
 * Tell the server that,
 * in the winning attack that just occur for the current player,
 * the player decided to distribute force as follows.
 * @param extraTroops
 * 	number of troops to put in the conquered region further than minimum required.
 */
function GA_DistributeAfterConquest(extraTroops) {
	GameAction.call(this);
	this.gameActionType = GA_DistributeAfterConquest.gameActionType;
	this.extraTroops = extraTroops;
}
GA_DistributeAfterConquest.gameActionType = 4;
GA_DistributeAfterConquest.prototype = new GameAction();
GA_DistributeAfterConquest.prototype.constructor = GA_DistributeAfterConquest;

/**
 * Tell the server that,
 * the current player decide to end his attack phase.
 */
function GA_Attacked() {
	GameAction.call(this);
	this.gameActionType = GA_Attacked.gameActionType;
}
GA_Attacked.gameActionType = 5;
GA_Attacked.prototype = new GameAction();
GA_Attacked.prototype.constructor = GA_Attacked;

/**
 * Tell the server that,
 * the current player decide to end his redeployment phase
 * with the following 'changes'
 * 
 * @param changes
 * 	= [ [regionSrc regionDes amount] [regionSrc regionDes amount] ... ]
 */
function GA_Redeployed(changes) {
	GameAction.call(this);
	this.gameActionType = GA_Redeployed.gameActionType;
	this.changes = changes;
}
GA_Redeployed.gameActionType = 6;
GA_Redeployed.prototype = new GameAction();
GA_Redeployed.prototype.constructor = GA_Redeployed;