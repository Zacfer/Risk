/**
 * super class of all game events
 * 
 * Game events are events that signals
 * a transition in game flow.
 * This is only those such event that needs to be on client side.
 * These event will be sent as message from server side to client side only NOT vice versa.
 * Because game event that will flow the game should never be generated from client side.
 */
function GameEvent(gameId, time) {
	GameMessage.call(this, gameId, time);
	// distinguish each type of game event
	this.gameEventType = GameEvent.gameEventType;
}
GameEvent.gameEventType = 0;
GameEvent.prototype = new GameMessage();
GameEvent.prototype.constructor = GameEvent;

/**
 * super class of all game events in the setting up phase
 * where initial territories and troops are determined.
 */
function GE_SettingUp(gameId, time) {
	GameEvent.call(this, gameId, time);
}
GE_SettingUp.prototype = new GameEvent();
GE_SettingUp.prototype.constructor = GE_SettingUp;

/**
 * Event that, in setup phase,
 * a player distributed 1 troop on his hand to a 'region'.
 * 
 * A client receiving this as message should
 * increment the amount of troop in the region by one.
 * 
 * This also signals that the next client who
 * has some troops left should start distributing.
 * 
 * If no client has any troops left,
 * this signals the transition into
 * playing phase's reinforcement state of the first player in the turn order.
 */
function GE_SU_Distributed(gameId, time, region) {
	GE_SettingUp.call(this, gameId, time);
	this.gameEventType = GE_SU_Distributed.gameEventType;
	this.region = region;
}
GE_SU_Distributed.gameEventType = 1;
GE_SU_Distributed.prototype = new GE_SettingUp();
GE_SU_Distributed.prototype.constructor = GE_SU_Distributed;

/**
 * superclass of all event in playing phase
 */
function GE_Playing(gameId, time) {
	GameEvent.call(this, gameId, time);
}
GE_Playing.prototype = new GameEvent();
GE_Playing.prototype.constructor = GE_Playing;

/**
 * Event that the current player has finished his
 * reinforcement phase and moving into attack phase.
 * @param trade
 * 	array of cards that the current player trade
 * 	or null if he doesn't trade.
 * @param reinforce 
 * 	array of pairs (pair is also represented with array),
 * 	each pair is the region ID and the reinforcement it received.
 *  So it would look like this in JSON syntax:
 * 	[ [region1 inc1] [region2 inc2] [region3 inc3] ]
 */
function GE_P_Reinforced(gameId, time, trade, reinforce) {
	GE_Playing.call(this, gameId, time);
	this.gameEventType = GE_P_Reinforced.gameEventType;
	this.trade = trade;
	this.reinforce = reinforce;
}
GE_P_Reinforced.gameEventType = 2;
GE_P_Reinforced.prototype = new GE_Playing();
GE_P_Reinforced.prototype.constructor = GE_P_Reinforced;

/**
 * Event of the result of each attack the current user made.
 * This broadcast the result of attack to all client.
 * 
 * In the case that the change to number of troops in the destination
 * region will make that region has 0 troop,
 * The region will change its owner to the attacking player
 * and troops = number of dice used to attack will be moved from the attacking region and put
 * in the conquered region.
 * 
 * If the result of the attack clear the mission for someone,
 * the playing phase ends.
 * 
 * @param regionSrc
 * 	source of the attack
 * @param regionDes
 * 	destination of attack
 * @param changeSrc
 * 	change in number of troops in the source region
 * 	This can be 0,-1 or -2.
 * @param changeDes
 * 	change in number of troops in the destination region.
 * 	This can be 0,-1 or -2.
 */
function GE_P_Attack(gameId, time, regionSrc, regionDes, changeSrc, changeDes) {
	GE_Playing.call(this, gameId, time);
	this.gameEventType = GE_P_Attack.gameEventType;
	this.regionSrc = regionSrc;
	this.regionDes = regionDes;
	this.changeSrc = changeSrc;
	this.changeDes = changeDes;
}
GE_P_Attack.gameEventType = 3;
GE_P_Attack.prototype = new GE_Playing();
GE_P_Attack.prototype.constructor = GE_P_Attack;

/**
 * Event telling the result of distribution of troops
 * after successful conquest.
 * 
 * @param regionSrc
 * 	source of the attack
 * @param regionDes
 * 	destination of attack
 * @param troopSrc
 * 	resulting troop in the source of attack
 * @param troopDes
 *  resulting troop in the destination of attack 
 */
function GE_P_DistributeAfterConquest(gameId, time, regionSrc, regionDes, troopSrc, troopDes) {
	GE_Playing.call(this, gameId, time);
	this.gameEventType = GE_P_DistributeAfterConquest.gameEventType;
	this.regionSrc = regionSrc;
	this.regionDes = regionDes;
	this.troopSrc = troopSrc;
	this.troopDes = troopDes;
}
GE_P_DistributeAfterConquest.gameEventType = 4;
GE_P_DistributeAfterConquest.prototype = new GE_Playing();
GE_P_DistributeAfterConquest.prototype.constructor = GE_P_DistributeAfterConquest;

/**
 * Event that the current player has decided to finished his
 * attack phase and moving into move phase.
 * @param cardId
 *  normal ID of card that is rewarded to the current player which is THIS client
 * 	-2 if a card is rewarded to the current player which isn't THIS client.
 * 	null if no bonus card rewarded for the current player.
 */
function GE_P_Attacked(gameId, time, cardId) {
	GE_Playing.call(this, gameId, time);
	this.gameEventType = GE_P_Attacked.gameEventType;
	this.cardId = cardId;
}
GE_P_Attacked.gameEventType = 5;
GE_P_Attacked.prototype = new GE_Playing();
GE_P_Attacked.prototype.constructor = GE_P_Attacked;

/**
 * Event that the current player has decided to finished his
 * redeployment phase and moving into reinforcement phase
 * of the next player.
 * 
 * The result of redeployment is as in 'changes'
 * @param changes
 * 	= [ [regionSrc regionDes amount] [regionSrc regionDes amount] ... ]
 */
function GE_P_Redeployed(gameId, time, changes) {
	GE_Playing.call(this, gameId, time);
	this.gameEventType = GE_P_Redeployed.gameEventType;
	this.changes = changes;
}
GE_P_Redeployed.gameEventType = 6;
GE_P_Redeployed.prototype = new GE_Playing();
GE_P_Redeployed.prototype.constructor = GE_P_Redeployed;