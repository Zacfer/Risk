/*
 * game flow state on client side
 * note that since this is on client side,
 * it's going to skip a lot of game states
 * that is server specific. 
 */

/**
 * super class of all game flow states.
 */
function GameFlowState() {
	// id = 0 is for abstract states that is invalid to initiailise.
	this.id = GameFlowState.id;
	this.name = 'name of the game state';
	/**
	 * Needs to be overwritten by subclasses.
	 * DON'T call this directly. use doHandleEvent.
	 * 
	 * @returns true iff the gameMessage is really processed
	 */
    this.eventHandler = function(gameMessage) {return false;};
    /**
     * Call this function to handle the GameMessage,
     * not the eventHandler directly
     */
    this.doHandleEvent = function(gameMessage) {
    	if(this.eventHandler(gameMessage)) {
    		console.warn(gameMessage.time, JSON.stringify(gameMessage));
    		// update game time
    		game.time = gameMessage.time;
    		// contract with shane's view
    		View.notify();
    		
    		// if some conquest JUST occur 
    		if(game.temps.lastVictory != null) {
				// if the client is the one who is winning,
				if(client instanceof PlayerClient && client.player === game.currentPlayer)
					// prompt for movement after conquest
					this.promptDistributeAfterConquest();
				// clear last victory
				game.temps.lastVictory = null;
    		}
    	}else {
    		console.info('not expecting gameMessage:'
    				+JSON.stringify(gameMessage)
    				+' while in state # '+this.id);
    	}
    };
}
GameFlowState.id = 0;

/**
 * super class of game flow states that
 * is in setting up phase.
 */
function GFS_SettingUp() {
	GameFlowState.call(this);
}
GFS_SettingUp.prototype = new GameFlowState();
GFS_SettingUp.prototype.constructor = GFS_SettingUp;

/**
 * Currently the only state in setting up phase.
 * This is the starting state of game.
 */
function GFS_SU_DistributingInitialForces() {
	GameFlowState.call(this);
	this.id = GFS_SU_DistributingInitialForces.id;
	this.name = 'distribution phase';
	this.eventHandler = function(gameMessage) {
		if(gameMessage instanceof GE_SU_Distributed) {
			game.distribute(gameMessage.region);
			return true;
		}
		return false;
	};
}
GFS_SU_DistributingInitialForces.id = 1;
GFS_SU_DistributingInitialForces.prototype = new GFS_SettingUp();
GFS_SU_DistributingInitialForces.prototype.constructor = GFS_SU_DistributingInitialForces;

/**
 * superclass of all state while playing. 
 */
function GFS_Playing() {
	GameFlowState.call(this);
}
GFS_Playing.prototype = new GameFlowState();
GFS_Playing.prototype.constructor = GFS_Playing;

/**
 * State that the current player is reinforcing
 */
function GFS_P_Reinforce() {
	GFS_Playing.call(this);
	this.id = GFS_P_Reinforce.id;
	this.name = 'reinforcement phase';
	this.eventHandler = function(gameMessage) {
		if(gameMessage instanceof GE_P_Reinforced) {
			// remove traded cards if any
			for(var i=0; i<gameMessage.trade.length; i++) {
				game.currentPlayer.discard(game.cards.cardsById[trade[i]]);
			}
			// update the number of troops
			for(var i=0; i<gameMessage.reinforce.length; i++) {
				var regionId = gameMessage.reinforce[i][0];
				var inc = gameMessage.reinforce[i][1];
				game.currentPlayer.doReinforce(game.map.regions[regionId], inc);
			}
			// move state
			game.changeState(GFS_P_Attack);
			return true;
		}
		return false;
	};
}
GFS_P_Reinforce.id = 2;
GFS_P_Reinforce.prototype = new GFS_Playing();
GFS_P_Reinforce.prototype.constructor = GFS_P_Reinforce;

/**
 * State that the current player is attacking
 */
function GFS_P_Attack() {
	GFS_Playing.call(this);
	this.id = GFS_P_Attack.id;
	this.name = 'attack phase';
	this.eventHandler = function(gameMessage) {
		if(gameMessage instanceof GE_P_Attack) {
			// update the number of troops in regions involved
			var regionSrc = game.map.regions[gameMessage.regionSrc];
			var regionDes = game.map.regions[gameMessage.regionDes];
			var troopsUsed = Math.min(3,regionSrc.troops-1);
			regionSrc.troops += gameMessage.changeSrc;
			regionDes.troops += gameMessage.changeDes;
			// is it a victory?
			if(regionDes.troops == 0) {
				// remember who win who lose
				var winner = regionSrc.owner;
				var loser = regionDes.owner;
				// change region's ownership
				regionDes.owner = winner;
				removeFromArray(regionDes, loser.ownedRegions);
				winner.ownedRegions.push(regionDes);
				// move the minimum troops to destination
				regionDes.troops = troopsUsed + gameMessage.changeSrc;
				regionSrc.troops -= troopsUsed + gameMessage.changeSrc;
				// remember the last victory
				game.temps.lastVictory = {regionSrc:regionSrc, regionDes:regionDes};
				// have a player lost?
				loser.checkIfLost();
				// is it a game end?
				if(winner.mission.isComplete()) {
					console.info('game ended');
					game.changeState(GFS_END);
					game.winner = regionSrc.owner;
				}
				// update view
				regionSrc.view.repaint();
				regionDes.view.repaint();
				winner.updateStatusPanel();
				loser.updateStatusPanel();
			}else {
				regionSrc.view.drawTroopData();
				regionDes.view.drawTroopData();
			}
			return true;
		}else if(gameMessage instanceof GE_P_DistributeAfterConquest) {
			// update according to the distribution
			var regionSrc = game.map.regions[gameMessage.regionSrc];
			var regionDes = game.map.regions[gameMessage.regionDes];
			regionSrc.troops = gameMessage.troopSrc;
			regionDes.troops = gameMessage.troopDes;
			regionSrc.view.drawTroopData();
			regionDes.view.drawTroopData();
			return true;
		}else if(gameMessage instanceof GE_P_Attacked) {
			if(gameMessage.cardId == -2) {
				game.currentPlayer.numCards++;
				game.currentPlayer.updateStatusPanel();
			}else if(gameMessage.cardId != null) {
				client.getCard(game.cards.cardsById[gameMessage.cardId]);
			}
			// move state
			game.changeState(GFS_P_Redeploy);
			return true;
		}
		return false;
	};
	this.promptDistributeAfterConquest = function() {
		// temporary disable
		return;
		
		var source = game.temps.lastVictory.regionSrc;
		var dest = game.temps.lastVictory.regionDes;
		if(source.troops > 1) {
			var numTroops = getIntegerInput("Please input the number of troops to move.\n(" + String(source.troops-1) + " troop" + ((source.troops > 2)?"s":"") + " available)", 0, "\nNot a valid input.", 0, source.troops - 1);
			if(numTroops > 0) {
				source.view.drawTroopData(source.troops - numTroops);
				dest.view.drawTroopData(dest.troops + numTroops);
				View.updateTroopCache();
				if(!(new GA_DistributeAfterConquest(numTroops)).send()) {
					source.view.drawTroopData();
					dest.view.drawTroopData();
					View.updateTroopCache();
				}
			}
		}
	};
}
GFS_P_Attack.id = 3;
GFS_P_Attack.prototype = new GFS_Playing();
GFS_P_Attack.prototype.constructor = GFS_P_Attack;

/**
 * State that the current player is attacking
 */
function GFS_P_Redeploy() {
	GFS_Playing.call(this);
	this.id = GFS_P_Redeploy.id;
	this.name = 'redeployment phase';
	this.eventHandler = function(gameMessage) {
		if(gameMessage instanceof GE_P_Redeployed) {
			for(var i=0; i<gameMessage.changes.length; i++) {
				var change = gameMessage.changes[i];
				var regionSrc = game.map.regions[change[0]];
				var regionDes = game.map.regions[change[1]];
				var amount = change[2];
				regionSrc.troops -= amount;
				regionDes.troops += amount;
				// update view
				regionSrc.view.drawTroopData();
				regionDes.view.drawTroopData();
			}
			// next player, next turn
			game.currentPlayer = game.getNextPlayer();
			game.changeState(GFS_P_Reinforce);
			return true;
		}
		return false;
	};
}
GFS_P_Redeploy.id = 4;
GFS_P_Redeploy.prototype = new GFS_Playing();
GFS_P_Redeploy.prototype.constructor = GFS_P_Redeploy;

/**
 * State that the game has ended.
 */
function GFS_End() {
	GameFlowState.call(this);
	this.id = GFS_End.id;
	this.name = 'game ended';
	this.eventHandler = function(gameMessage) {
		// shouldn't have anything here
		return false;
	};
}
GFS_End.id = 5;
GFS_End.prototype = new GameFlowState();
GFS_End.prototype.constructor = GFS_End;

/**
 * Set of all game states in normal rule
 */
function GameStates() {
	this.states = [];
	this.states[GFS_SU_DistributingInitialForces.id] = new GFS_SU_DistributingInitialForces();
	this.states[GFS_P_Reinforce.id] = new GFS_P_Reinforce();
	this.states[GFS_P_Attack.id] = new GFS_P_Attack();
	this.states[GFS_P_Redeploy.id] = new GFS_P_Redeploy();
	this.states[GFS_End.id] = new GFS_End();
}