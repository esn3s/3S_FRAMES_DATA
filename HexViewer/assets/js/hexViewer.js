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
	e.setAttribute("id", id);
	e.setAttribute("class", cl);
	
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
	this.nbRows = options.rows || 32;			// nb rows to display...
	this.addr = options.addr || 0x02001230; 				// start address, decimal...
	this.data = options.data || [];			// full set of data for all frames, string...
	this.index = 0;								// index of data to read...
	
	this.knownRanges = [];						// list of known ranges with their info...
	
	// determine occurence of object to build prefix...
	this.occurenceCounter++;
	this.suffix = this.occurenceCounter;
	
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
		this.initAddress();
	},
	
	// build header...
	initHeader: function() {
		var s = "";
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
		var s = "";
		var j = this.nbRows;
		var addr = this.addr;
		var div = "addr" + this.suffix + "_";
		
		for(var i = 0; i < j; i++) {
			var e = document.createElement("div");
			e.appendChild(document.createTextNode("0x" + pad((addr + i * 16).toString(16).toUpperCase(), 8)));
			this._cdiv.address.appendChild(e);
		}
	},
	
	// build structure if needed...
	initStructure: function() {
		// container div...
		this._cdiv.base = document.getElementById(this.div.base);
		
		// may be optimized by using createDocumentFragment, populating its DOM and append it to base...
		
		var addr = newElement("div", this.div.address, "address");
		var hex = newElement("div", this.div.hex, "");
		var hex_header = newElement("div", this.div.header, "hex_header");
		var hex_data = newElement("div", this.div.data, "hex_data");
		hex.appendChild(hex_header);
		hex.appendChild(hex_data);
		var text = newElement("div", this.div.text, "hex_text");
		var info = newElement("div", this.div.info, "hex_info");
		
		this._cdiv.base.appendChild(addr);
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
	
	// display data for given index...
	displayData: function(index) {
		index = index || 0; // display index 0 by default...
		
		// refresh data display...
		this.displayDataForIndex(index);
		
		// check for known ranges...
		this.drawKnownRanges();
	},
	
	// replace content of hex data...
	displayDataForIndex: function(index) {
		var data = this.data[index] || "out of bound index '" + index + "'";
		
		// cut every line of data...
		
		console.log("displayDataForIndex", data);
	},
	
	// update data array to display...
	setData: function(addr, data) {
		this.addr = addr || 0;
		
		if(data.constructor === Array) {
			this.data = data;
		}
		else {
			this.data = [data];
		}
	},
	
	// check known ranges and display them on screen...
	drawKnownRanges: function() {
	
	},
	
	// update values in data inspector part...
	updateDataInspector: function(data) {
		
	},
	
	updateWithSelectedRange: function(data) {
		// find all selected...
		var offsetStart, offsetEnd, data;
		var list = $("span.selected", "#hex_data");
		
		if(list.length > 0) {
			// read first and last to calculate range...
			var tmp1 = list[0].id.split("_");
			var tmp2 = list[list.length - 1].id.split("_");
			
			// index 1 is row, index 2 is column...
			offsetStart = parseInt(this.addr + tmp1[1]);
			offsetEnd = parseInt(this.addr + tmp2[1]);
			
			offsetStart = "0x" + pad(offsetStart.toString(16), 8);
			offsetEnd = "0x" + pad(offsetEnd.toString(16), 8);
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
			//$("#value_byte_unsigned").val(parseInt(dataFinal, 16));
			$("#value_byte_signed").val(hexByte2signed(dataFinal));
			$("#value_word_unsigned").val(parseInt(dataFinal, 16));
		}
		else if(data.length == 4) {
			$("#value_word_unsigned").val(parseInt(dataFinal, 16));
			$("#value_word_signed").val(hexWord2signed(dataFinal));
			$("#value_dword").val("0x" + dataFinal);
		}
	},
	
	initDivHexData: function() {
		var s = [];
		var size = this.nbRows;
		var a = this.addr;
		
		for(var r = 0; r < size; r++) {
			for(var i = 0, o = r * 16; i < 8; i++, o+=2, a++) s.push("<span id=\"data_" + a + "\">" + this.data[o] + this.data[o + 1] + "</span>");
			s.push("&nbsp;");
			for(var i = 8; i < 16; i++, o+=2, a++) s.push("<span id=\"data_" + a + "\">" + this.data[o] + this.data[o + 1] + "</span>");
			s.push("<br />\n");
		}
		
		$("#hex_data").html(s.join(""));
		
		console.log("initDivHexData");
	},
	initDivHexText: function() {
		
	},
	initDivHexInfo: function() {
		
	},
	loadData: function() {
		this.initDivAddress();
		this.initDivHexData();
		this.initDivHexText();
		this.initDivHexInfo();

		this.getKnownRanges();
		this.checkKnownRanges();
	},
	getData: function(addr) {
		this.addr = addr;// || 0x02000000;
		this.data = "FFC0000E003A000C0000000000000000FFA20016004C0012FFCE001A00320014FFB6001A003E0014000000000000000000000000000000000000000000000000FFA80018004800120000000000000000FFC0002800260020FFCE0018001200120000000000000000000000000000000FFD00020002E0020FFDC00140052003400000000000000000000000000000000FFE00012007600140000000000000000FFD40018003800140000000000000000FFE000100076000E0000000000000000FFDA00100036000E0000000000000000FFBE002E00240024FFD000200010001800000000000000000000000000000000FFC0002C00340024000000000000000000000000000000000000000000000000FFC2002A003C0022000000000000000000000000000000000000000000000000FFC4002800600020000000000000000000000000000000000000000000000000FFB40016002E00120000000000000000FFCC0016003600120000000000000000FFBA00120034000E0000000000000000";
		this.data = "FFFFFFFEFFFDFF01FF0000FF00FE";
		
		this.loadData();
		
		return;
		
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
