"use strict";

/*
3S Hex Viewer object
Display a chunk of hex data and perform search.
Ideas:
- require a div id to build hex table inside
- data to display is a raw JSON: json = { addr = 0x00000000, data = "08ff5687bc...etc..." }
- load a list of all known range with additional info like name, type, comments...
- bind a given range to a display widget (timer/gauge, etc)
- data are selectable to keep them highlighted during work session
- tooltip with all possible value taken by pointed data
- if a range is identified as a valid address, possibility to view target in another window

by ESN@2015
*/
