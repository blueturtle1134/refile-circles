/*
One unit of element radius. This is a property of the actual image files, which are 1550x1550 right now.
This leads to really big numbers in render-space, but it's all getting scaled anyway so who cares.
All this feels very stupid and I'm not convinced that there isn't a better way
*/
const R = 1550;

// Define class for elements
class Element { // Not the kind you're thinking of, Javascript
	constructor(name, abbr, key, cost) {
		this.name = name;
		this.abbr = abbr;
		this.key = key;
		this.cost = cost;
	}
}

// Elements data list
const ELEMENTS = [
	new Element("Beige", "Bg", "", 2),
	new Element("Black", "Bk", "", 2),
	new Element("Blue", "Bu", "", 4),
	new Element("Brown", "Br", "", 1),
	new Element("Cream", "Cm", "", 2),
	new Element("Gold", "Gd", "", 4),
	new Element("Green", "Gn", "", 2),
	new Element("Grey", "Gy", "", 4),
	new Element("Indigo", "In", "", 1),
	new Element("Metallic", "Mc", "", 2),
	new Element("Navy", "Nv", "", 1),
	new Element("Orange", "Og", "", 4),
	new Element("Pink", "Pk", "", 2),
	new Element("Purple", "Pu", "", 2),
	new Element("Rainbow", "Rb", "", 2),
	new Element("Red", "Rd", "", 1),
	new Element("Silver", "Sv", "", 2),
	new Element("Sky", "Sk", "", 2),
	new Element("Transparent", "Tr", "", 1),
	new Element("Vermilion", "Ve", "", 1),
	new Element("White", "Wh", "", 1),
	new Element("Yellow", "Yw", "", 1),
];

// Generate maps
const SYMBOLS = new Map();
for (e of ELEMENTS) {
	SYMBOLS.set(e.abbr.toLowerCase(), e);
}

// Define classes for the circle types
class ElementCircle {
	constructor(e) {
		this.e = e;
	}
	
	get radius() {
		return 1; // Elementary circle has radius 1
	}
	
	draw() {
		let raster = new paper.Raster(this.e.name);
		return raster;
	}
	
	copy() {
		return new ElementCircle(this.e);
	}
}

class CompoundCircle {	
	constructor(subcircles, overlay) {
		this.subcircles = subcircles;
		this.overlay = overlay;
	}
	
	get size() {
		return this.subcircles.length;
	}
	
	maxSubSize() {
		// Maximum size of a subcircle
		let result = 1; // By default, assume empty slots are elementals
		for (const sub of this.subcircles) {
			if (sub !== null) {
				result = Math.max(result, sub.radius);
			}
		}
		return result;
	}
	
	coreSize() {
		// Size of the overlay/override
		if (this.overlay !== null) {
			return this.overlay.radius;
		}
		else {
			return 1; // Leave space for an elemental
		}
	}
	
	mainRadius() {
		// Radius of the circle itself
		// return Math.max(this.coreSize() + 2*this.maxSubSize() + 0.5);
		return Math.max(this.maxSubSize() + this.coreSize() + 0.5, (this.maxSubSize()+0.25) / Math.sin(Math.PI/this.size));
	}
	
	get radius() {
		return this.mainRadius() + this.maxSubSize();
	}
	
	draw() {
		let cRadius = 0.5*this.mainRadius()*R;
		
		let circleBB = new paper.Rectangle(new paper.Point(-cRadius, -cRadius), new paper.Point(cRadius, cRadius));
		let circle = new paper.Path.Ellipse(circleBB);
		circle.fillColor = "white";
		
		let points = [];
		for (let i = 0; i<this.size; i++) {
			let angle = 2 * Math.PI * i / this.size;
			points.push(new paper.Point(cRadius * Math.sin(angle), -cRadius * Math.cos(angle)));
		}
		
		// TODO: replaced by overwrite if one exists
		// TODO: this method does NOT work for amplified circles!
		let support = new paper.Path(points);
		support.add(points[0]);
		
		let group = new paper.Group([circle, support]);
		
		if (this.overlay !== null) {
			let center = new paper.Point(0,0);
			
			for (let i = 0; i<this.size; i++) {
				group.addChild(new paper.Path([center, points[i]]));
			}
			
			let overlayImage = this.overlay.draw();
			overlayImage.position = center;
			group.addChild(overlayImage);
		}
		
		// TODO: a dash for null circles
		for (let i = 0; i<this.size; i++){
			let sub = this.subcircles[i];
			let point = points[i];
			let subImage = sub.draw();
			subImage.position = point;
			group.addChild(subImage);
		}
		
		group.strokeColor = "black";
		group.strokeWidth = R*0.002;
		return group;
	}
	
	copy() {
		let subcircles = [];
		for (const sub of this.subcircles) {
			subcircles.push(sub.copy());
		}
		let overlay = null;
		if (this.overlay !== null) {
			overlay = this.overlay.copy();
		}
		return new CompoundCircle(subcircles, overlay);
	}
}

function canRemove(string) {
	if (string[0] !== "(" || string[string.length-1] !== ")") {
		return false;
	}
	let current = 0;
	for (let i = 1; i<string.length-1; i++) {
		if (string[i] === "(") {
			current++;
		}
		else {
			if (string[i] === ")") {
				current--;
				if (current < 0) {
					return false;
				}
			}
		}
	}
	return true;
}

function removeParens(string) {
	while(canRemove(string)) {
		string = string.substring(1, string.length-1);
	}
	return string;
}

function searchOutsideParens(string, target) {
	let current = 0;
	let results = [];
	for (let i = 0; i<string.length; i++) {
		let x = string[i];
		if (x === "(") {
			current++;
		}
		else if (x === ")") {
			current--;
		}
		else if (current === 0 && x === target) {
			results.push(i);
		}
	}
	return results;
}

function splitByIndex(string, indices) {
	if (indices.length === 0) {
		return [string];
	}
	let last = -1;
	let result = [];
	for (const i of indices) {
		result.push(string.substring(last+1, i));
		last = i;
	}
	result.push(string.substring(last+1));
	return result;
}

function parseShorthand(string) {
	// Remove all parens
	string = removeParens(string);
	
	// If string is now pure alphabetical, try to lookup as element.
	if (/^[a-zA-Z]+$/.test(string)) {
		let e = SYMBOLS.get(string.toLowerCase());
		return new ElementCircle(e);
	}
	
	// Split on overlay symbol, if it exists, and recurse
	let bangs = searchOutsideParens(string, "!");
	if (bangs.length > 0) {
		let last = bangs.at(-1);
		let left = parseShorthand(string.substring(0, last));
		let right = parseShorthand(string.substring(last+1));
		right.overlay = left;
		return right;
	}
	
	// Split on slashes
	let parts = splitByIndex(string, searchOutsideParens(string, "/"));
	
	// Extract numbers.
	let numbers = Array(parts.length);
	for (let i = 0; i<parts.length; i++) {
		let matched = parts[i].match(/^(\d+)(.+)$/);
		if (matched) {
			numbers[i] = parseInt(matched[1]);
			parts[i] = matched[2];
		}
		else {
			numbers[i] = 1;
		}
	}
	
	// Evaluate circles, multiply by numbers, and return.
	let subcircles = [];
	for (let i = 0; i<parts.length; i++) {
		let subcircle = parseShorthand(parts[i]);
		if (numbers[i] === 1) {
			subcircles.push(subcircle);
		}
		else {
			for (let j = 0; j<numbers[i]; j++) {
				subcircles.push(subcircle.copy());
			}
		}
	}
	
	result = new CompoundCircle(subcircles, null);
	return result;
}

window.onload = function() {
	var canvas = document.getElementById("canvas");
	paper.setup(canvas);
	
	// If resize is set, the canvas size tags are ignored if element size is specified
	// If resize is not set, the canvas size always matches the element size
	// Setting the size programmatically, while odd, is my only means of actually doing supersampling
	// It also leads to a flicker of incorrect size at the start, ugh
	paper.view.viewSize = new paper.Size(1550, 1550);
	canvas.style.height = "70vmin";
	canvas.style.width = "70vmin";
	
	circle = new CompoundCircle([
		new CompoundCircle([
				new ElementCircle(ELEMENTS[7]),
				new ElementCircle(ELEMENTS[10])
			],
			null
		),
		new ElementCircle(ELEMENTS[13]),
		new CompoundCircle([
				new ElementCircle(ELEMENTS[18]),
				new ElementCircle(ELEMENTS[7])
			],
			null
		)],
		new ElementCircle(ELEMENTS[19])
	);
	
	let background = new paper.Path.Rectangle(paper.view.viewSize);
	background.fillColor = "white";
	var render = circle.draw();

	rescale = function() {
		// Resize the render to fit and place it in the center of the view
		let viewBounds = paper.view.bounds;
		let rendBounds = render.bounds;
		let factor = Math.min(viewBounds.width/rendBounds.width, viewBounds.height/rendBounds.height);
		render.scale(factor);
		render.position = paper.view.center;
		paper.view.draw();
	}
	
	showCircle = function(c) {
		circle = c;
		render.remove();
		render = c.draw();
		rescale();
	}
	
	rescale();

	paper.view.onResize = function(event) {
		rescale();
	}

	download = function(filename){
		var link = document.createElement('a');
		link.download = filename + ".png";
		link.href = document.getElementById('canvas').toDataURL()
		link.click();
	}
	
	// Below functions are specific to the "tech demo" and may be changed in the full version
	
	convert = function() {
		let inputText = document.getElementById("inputText").value.replaceAll(" ", "");
		try {
			showCircle(parseShorthand(inputText));
			showStatus("Parsed " + inputText);
		}
		catch (error) {
			console.error(error);
			showStatus("Error.");
		}
	}
	
	convertAndDownload = function() {
		let inputText = document.getElementById("inputText").value.replaceAll(" ", "");
		try {
			showCircle(parseShorthand(inputText));
			download(inputText);
			showStatus("Parsed " + inputText + ", image downloaded.");
		}
		catch (error) {
			console.error(error);
			showStatus("Error.");
		}
	}
	
	showStatus = function(string) {
		document.getElementById("status").innerText = string;
	}
	
	showStatus("Converter ready.");
}

