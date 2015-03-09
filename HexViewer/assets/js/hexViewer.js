// IIFE, prefixed by a comma...
;(function(window, document, undefined) {
	"use strict";

/*
3S Hex Viewer object
Display a chunk of hex data and perform search.
Ideas:
- require a div id to build hex table inside
- data to display is a raw JSON: json = { addr = 0x00000000, data = "08ff5687bc...etc..." }
- call a php API to retrieve data from a given address
- load a list of all known range with additional info like name, type, comments...
- bind a given range to a display widget (timer/gauge, etc)
- data are selectable to keep them highlighted during work session
- tooltip with all possible value taken by pointed data
- if a range is identified as a valid address, possibility to view target in another window
- mode where for every 4 bytes block displayed starting by 01/02/3/04/05/06/07/08/09 (maybe not real need of more than 06)
    -> check if it's a known address and propose to view target in another window
    -> highlight address and propose to view content of target
    -> check if it's a know address and show 

- table to create in DB: 3s_known_range:
	- fields:
		- address
		- length (nb of bytes, x * 0x00)
		- type (b, bs, w, ws, dw, r (a region, itself may contain other known ranges)
		- name (for example: pos_x)
		- group (define groupname where this name belong, for example: P1)
©ESN@2015
*/

// add 0 before, if needed...
function pad (str, max) {
	str = str.toString();
	return str.length < max ? pad("0" + str, max) : str;
}

// convert an hex data (string) to signed decimal...
// inverse operation: num = -4; (num < 0 ? (0xFFFFFFFF + num + 1) : num).toString(16);
function hexByte2signed(h) {
	var a = parseInt(h, 16);
	var sd = ((a & 0x8000) > 0)?a - 0x10000:a;
	
	//console.log("hexByte2signed", h, sd);
	
	return sd;
}

function hexWord2signed(h) {
	var a = parseInt(h, 16);
	var sd = ((a & 0x80000) > 0)?a - 0x100000000:a;
	
	//console.log("hexWord2signed", h, sd);
	
	return sd;
}

// return a new element with given id and class attribute set...
function newElement(type, id, cl) {
	var e = document.createElement(type);
	if(id) e.setAttribute("id", id);
	if(cl) e.setAttribute("class", cl);
	
	return e;
}

/*
HexViewer 'class'...
options may content:
- nbRows
- div
- addr
- data
*/
function EHXV(options) {
	options = options || {};
	
	this.nbCols = options.cols || 16;			// nb cols to display...
	this.nbRows = options.rows || 64;			// nb rows to display...
	this.addr = options.addr || 0x02001230; 	// start address, decimal...
	this.data = options.data || [];				// full set of data for all frames, string...
	this.index = 0;								// index of data to read...
	this.lastFrameIndex = 0;					// last frame index...
	
	this.loop = false;							// loop through all frames using RAF?
	
	this.knownRanges = [];						// list of known ranges with their info...
	this.watchList = [];						// list of range to watch...
	
	// determine occurence of object to build prefix...
	EHXV.prototype.occurenceCounter++;
	this.suffix = EHXV.prototype.occurenceCounter;
	
	this.div = {
		base: options.div || "hxv",
		address: 	"address" + this.suffix,
		hex: 		"hex" + this.suffix,
		header: 	"hex_header" + this.suffix,
		data: 		"hex_data" + this.suffix,
		text: 		"hex_text" + this.suffix,
		info: 		"hex_info" + this.suffix,
	};
	
	// cached div...
	this._cdiv = {
		base: null,
		address: null,
		hex: null,
		header: null,
		data: null,
		text: null,
		info: null,
	};
	
	// initialisation...
	this.init();
};

// class methods...
EHXV.prototype = {
	// occurence counter to know wich objects structure to use...
	occurenceCounter: 0,
	
	// init structure and prepare address div...
	init: function() {
		this.initStructure();
		this.initHeader();
		//this.initEvents();
	},
	
	// attach events to some keys...
	/*
		- -1	 : 37 (left)
		- +10	 : 38 (up)
		- +1	 : 39 (right)
		- -10	 : 40 (down)
		- first	 : 36 (home)
		- last	 : 35 (end)
		- start/stop : 45 (insert)
	*/
	initEvents: function() {
		// we pass only this cause cause browsers will automatically search for a function called 'handleEvent', and that way, we're able to access object data/methods... 
		//document.addEventListener("keyup", this, false);
	},
	
	// that name allow to have this being our EHXV object...
	handleEvent: function(e) {
		var k = e.which;
		
		if(e.shiftKey) {
			if(k === 37) 	  { this.controlStop(); this.index--; 	this.displayData(); }
			else if(k === 38) { this.controlStop(); this.index += 10; this.displayData(); }
			else if(k === 39) { this.controlStop(); this.index++; 	this.displayData(); }
			else if(k === 40) { this.controlStop(); this.index -= 10; this.displayData(); }
			else if(k === 36) { this.controlStop(); this.index = 0; 	this.displayData(); }
			else if(k === 35) { this.controlStop(); this.index = this.lastFrameIndex; this.displayData(); }
			else if(k === 45) { this.controlToggle(); }
		}
		
		//console.log(e.which);
	},
	
	// we need this little trick to be able to directly call object method, that = this...
	controlStart: function() { this.loop = true; var that = this; requestAnimationFrame(function() { return that.displayData(); }); },
	controlStop: function() { this.loop = false; },
	controlToggle: function() { (this.loop)?this.controlStop():this.controlStart(); },
	
	// display data...
	displayData: function() {
		if(this.loop) this.index++;
		
		if(this.index > this.lastFrameIndex) {
			this.index = 0;
		}
		else if(this.index < 0) {
			this.index = this.lastFrameIndex;
		}
		
		//console.log(this.index, that);
		
		// refresh data display...
		this.displayDataForIndex(this.index);
		
		// we need this little trick to be able to directly call object method...
		var that = this;
		if(this.loop) requestAnimationFrame(function() { return that.displayData(); });
	},
	
	// replace content of hex data...
	displayDataForIndex: function(index) {
		index = index || this.index;
		var data = ((new Date().getTime()) + "x" + this.data[index] || "out of bound index '" + index + "'").match(/.{1,2}/g); // better way possible?
		
		// update each span with proper value...
		// build nbRows div...
		var el = this._cdiv.data.childNodes;
		var i = el.length;
		
		// build new div content...
		for(var k = 0; k < i; k++) {
			if(el[k].id) el[k].textContent = data[k];
		}
		
		// update watch list...
		this.updateWatchListValues();
	},
	
	// refresh values of watch list if any...
	updateWatchListValues: function() {
		if(this.watchList.length > 0) {
			var wl = this.watchList;
			
			for(var i = 0; i < wl; i++) {
				console.log("updateWatchListValues", wl[i]);
			}
		}
	},
	
	addToWatchList: function(w) {
		console.log(w);
		this.watchList.push(w);
	},
	
	// update data array to display...
	setData: function(addr, data) {
		this.addr = addr || 0;
		
		// refresh address div...
		this.initAddress();
		
		// prepare hex data...
		this.initHexData();
		
		if(data.constructor === Array) {
			this.data = data;
		}
		else {
			this.data = [data];
		}
		
		// check for known ranges...
		this.drawKnownRanges();
		
		this.lastFrameIndex = this.data.length - 1;
	},
	
	// check known ranges and display them on screen...
	drawKnownRanges: function() {
	
	},
	
	// build header...
	initHeader: function() {
		var j = this.nbCols;
		
		for(var i = 0, k = 0; i < j; i++, k++) {
			// each 8, insert a space...
			if(k === 8) {
				this._cdiv.header.appendChild(document.createTextNode(" "));
				k = 0;
			}
			
			var span = document.createElement("span");
			span.appendChild(document.createTextNode(pad(i, 2)));
			this._cdiv.header.appendChild(span);
		}
	},
	
	// build address div...
	initAddress: function() {
		// build nbRows div...
		var j = this.nbRows;
		var addr = this.addr;
		//var div = "addr" + this.suffix + "_";
		
		// delete previous content...
		var el = this._cdiv.address;
		while(el.firstChild) el.removeChild(el.firstChild);
		
		// build new div content...
		for(var i = 0; i < j; i++) {
			var e = document.createElement("div");
			e.appendChild(document.createTextNode("0x" + pad((addr + i * 16).toString(16).toUpperCase(), 8)));
			el.appendChild(e);
		}
	},
	// build hex data div...
	initHexData: function() {
		// build nbRows div...
		var j = this.nbRows;
		var c = this.nbCols;
		var addr = this.addr;
		var id = "data" + this.suffix + "_";
		
		// delete previous content...
		var el = this._cdiv.data;
		while(el.firstChild) el.removeChild(el.firstChild);
		
		// build new div content...
		for(var i = 0; i < j; i++) {
			for(var k = 0; k < c; k++) {
				var e = document.createElement("span");
				e.id = id + (addr + j * 16 + k);
				e.appendChild(document.createTextNode(".."));
				el.appendChild(e);
				
				// each 8, insert a space...
				if(k === 7) el.appendChild(document.createTextNode(" "));
			}
			
			el.appendChild(document.createElement("br"));
		}
	},
	
	// build structure...
	initStructure: function() {
		// container div...
		this._cdiv.base = document.getElementById(this.div.base);
		
		var addr = newElement("div", this.div.address, "address");
		var hex = newElement("div", this.div.hex, "hex");
		var hex_header = newElement("div", this.div.header, "hex_header");
		var hex_data = newElement("div", this.div.data, "hex_data");
		hex.appendChild(addr);
		hex.appendChild(hex_data);
		var text = newElement("div", this.div.text, "hex_text");
		var info = newElement("div", this.div.info, "hex_info");
		
		this._cdiv.base.appendChild(hex_header);
		this._cdiv.base.appendChild(hex);
		this._cdiv.base.appendChild(text);
		this._cdiv.base.appendChild(info);
		
		// cache all...
		this._cdiv.address = addr;
		this._cdiv.hex = hex;
		this._cdiv.header = hex_header;
		this._cdiv.data = hex_data;
		this._cdiv.text = text;
		this._cdiv.info = info;
	},
	
	updateWithSelectedRange: function() {
		// find all selected...
		var offsetStart, offsetEnd, data;
		var list = $("span.selected", this._cdiv.hex);
		
		if(list.length > 0 && list.length < 8) {
			// read first and last to calculate range...
			var tmp1 = list[0].id.split("_");
			var tmp2 = list[list.length - 1].id.split("_");
			
			// index 1 is row, index 2 is column...
			offsetStart = "0x" + pad(parseInt(tmp1[1]).toString(16).toUpperCase(), 8);
			offsetEnd = "0x" + pad(parseInt(tmp2[1]).toString(16).toUpperCase(), 8);
			
			data = $.map(list, function(o) {
				return o.textContent;
			});
		}
		else {
			// no selected...
			offsetStart = "";
			offsetEnd = "";
			data = [];
		}

		$("#selectedRange_start").val(offsetStart);
		$("#selectedRange_end").val(offsetEnd);
		$("#selectedRange_data").val(data.join(""));
		
		// empty inspector fields...
		$("input", "#sidebar_data_insp").val("");
		
		// update values fields...
		var dataFinal = data.join("");
		
		if(data.length == 1) {
			$("#value_byte_unsigned").val(parseInt(dataFinal, 16));
		}
		else if(data.length == 2) {
			var signed = hexByte2signed(dataFinal);
			$("#value_word_signed").val(hexByte2signed(dataFinal));
			$("#value_word_unsigned").val(parseInt(dataFinal, 16));
		}
		else if(data.length == 4) {
			$("#value_word_unsigned").val(parseInt(dataFinal, 16));
			$("#value_dword").val("0x" + dataFinal);
		}
	},
	
	
	
	// old code...
	getData: function(addr) {
		$.get("data.json", { addr: addr }).done(function(data) {
			console.log("get data done", data);
			this.data = data.data;
		}).fail(function(a, b, c) { console.log("getData fail", a, b, c); });
	},
	getKnownRanges: function(start, end) {
		this.knownRanges = [
{"id":"1","address":"00000001","length":"1","type":"b","name":"osef","group":"osec","comment":"oseb"},
{"id":"2","address":"00000018","length":"2","type":"bs","name":"osef","group":"osec","comment":"oseb"},
{"id":"3","address":"00000027","length":"2","type":"w","name":"osef","group":"osec","comment":"oseb"},
{"id":"4","address":"0000003b","length":"2","type":"ws","name":"osef","group":"osec","comment":"oseb"},
{"id":"5","address":"00000080","length":"4","type":"dw","name":"osef","group":"osec","comment":"oseb"},
{"id":"5","address":"0200DC50","length":"4","type":"dw","name":"osef","group":"osec","comment":"oseb"},
		                    ];
	},
	checkKnownRanges: function() {
		for(var i in this.knownRanges) {
			var o = this.knownRanges[i];
			
			// find if on screen...
			var addr = o.address;
			var addrDec = parseInt(addr, 16);
			
			if(addrDec >= this.addr && addrDec <= this.addrEnd) {
				var p = [];
				for(var j = 0; j < o.length; j++) p.push("#data_" + (addrDec + j));
				$(p.join(",")).addClass("known_range_" + o.type);
			}
		}
	},
};

function WATCHER(options) {
	options = options || {};
	
	this.addr = options.addr || -1;
	this.size = options.size || -1;
	this.type = options.type || -1;
	this.targetDivs = $.map((options.targetDivs || []), function(o) { return o; });
	
	if(this.addr != -1 && this.size != -1 && this.type != -1) {
		WATCHER.prototype.counter++;
		this.number = WATCHER.prototype.counter;
		this.name = options.name || "Watcher #" + this.number;
		this.addrDec = parseInt(this.addr);
		this.init();
		this.update();
	}
};

// class methods...
WATCHER.prototype = {
	container: "sidebar_right",
	counter: -1,
	update: function() {
		read targetdivs and get values...
		this._c.textContent = new Date().getTime();
	},
	// draw in div...
	init: function() {
		// build elements...
		var div = "watcher_" + this.number;
		var container = newElement("div", div, "watcher");
		var name = newElement("span", null, "watcher_name");
		var data = newElement("span", div + "_data", "watcher_data span_" + this.type.toLowerCase());
		var del = newElement("span", div + "_del", "watcher_del");
		name.appendChild(document.createTextNode(this.name + " (" + this.addr + ")"));
		data.appendChild(document.createTextNode("..."));
		del.appendChild(document.createTextNode("x"));
		container.appendChild(name);
		container.appendChild(data);
		container.appendChild(del);
		
		document.getElementById(this.container).appendChild(container);
		
		this._c = data;
		
		// cache target divs...
		//this.targetDivs = $.map();
	},
	// remove watcher...
	remove: function() {
		
	},
};
	
	// attach to window to make class available globally...
	window.EHXV = EHXV
	window.WATCHER = WATCHER
})(window, document);
