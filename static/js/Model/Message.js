/**
 * Super class of all messages that is
 * to be send across the network.
 */
function Message() {
	// Tells what type of message this is.
	this.messageType = Message.messageType;
	this.send = function() {
		var xhr = new XMLHttpRequest();
        xhr.open('POST', '/gameAction?action=' + JSON.stringify(this), false);
        xhr.send();
        
        if((Math.floor(xhr.status/100) != 2 && xhr.status != 304) || xhr.responseText != '') {
			if(xhr.responseText == "Time does not match.\n")
				window.location.reload();
        	console.info('http code: '+xhr.status+'; respond: "'+xhr.responseText+'"');
        	return false;
        }else {
        	View.stopInput();
        	return true;
        }
	};
}
Message.messageType = 0;

/**
 * From server to all clients
 */
function ChatMessage(chat, userId) {
	Message.call(this);
	this.messageType = ChatMessage.messageType;
	this.chat = chat;
	this.userId = userId;
}
ChatMessage.messageType = 1;
ChatMessage.prototype = new Message();
ChatMessage.prototype.constructor = ChatMessage;

/**
 * This message gives client the game object
 * for the first time the game object is created.
 * It also gives permission for the client who
 * is the first one in the turn order to begin distributing
 * initial troops.
 * @param game
 * 	real game structure. not just id.
 */
function NewGame(game) {
	Message.call(this);
	this.messageType = NewGame.messageType;
	this.game = game;
}
NewGame.messageType = 2;
NewGame.prototype = new Message();
NewGame.prototype.constructor = NewGame;

/**
 * Super class of all in-between-game messages.
 * 
 * @param gameId
 *  ID of the game this message is related to.
 * @param time
 * 	the game logical time. (an integer)
 *  This logical time is incremented by the server
 *  for each new game event message the server created.
 */
function GameMessage(gameId, time) {
	Message.call(this);
	this.messageType = GameMessage.messageType;
	this.gameId = gameId;
	this.time = time;
	this.isProcessable = function() {
		return (this.time == game.time) || (this.time == game.time+1);
	};
}
GameMessage.messageType = 3;
GameMessage.prototype = new Message();
GameMessage.prototype.constructor = GameMessage;
GameMessage.constructFromRaw = function(raw) {
	if(raw.messageType!=3) {
		console.info('not a game message: '+JSON.stringify(raw));
		return null;
	}
	
	switch(raw.gameEventType) {
	case GE_SU_Distributed.gameEventType:
		return new GE_SU_Distributed(raw.gameId, raw.time, raw.region);
	case GE_P_Reinforced.gameEventType:
		return new GE_P_Reinforced(raw.gameId, raw.time, raw.trade, raw.reinforce);
	case GE_P_Attack.gameEventType:
		return new GE_P_Attack(raw.gameId, raw.time, raw.regionSrc, raw.regionDes, raw.changeSrc, raw.changeDes);
	case GE_P_DistributeAfterConquest.gameEventType:
		return new GE_P_DistributeAfterConquest(raw.gameId, raw.time, raw.regionSrc, raw.regionDes, raw.troopSrc, raw.troopDes);
	case GE_P_Attacked.gameEventType:
		return new GE_P_Attacked(raw.gameId, raw.time, raw.cardId);
	case GE_P_Redeployed.gameEventType:
		return new GE_P_Redeployed(raw.gameId, raw.time, raw.changes);
	default:
		console.info('unrecognised game message: '+JSON.stringify(raw));
	}
};