// Adjustable constants
LINE_WIDTH = 5;
COND_WIDTH = 200;

/*
One unit of element radius. This is a property of the actual image files, which are 1550x1550 right now.
This leads to really big numbers in render-space, but it's all getting scaled anyway so who cares.
All this feels very stupid and I'm not convinced that there isn't a better way
*/
const R = 1550/2;

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

// Helper method for polar coordinates
function polar(r, theta) {
	let result = new paper.Point(r * Math.sin(theta), -r * Math.cos(theta));
	return result;
}

// Define classes for the circle types
class ElementCircle {
	constructor(e) {
		this.e = e;
		this.elem = true;
	}
	
	// All radii of an elementary circle are 1 (we use elementary circles as the unit of radius)
	
	get radius() {
		return 1;
	}
	
	mainRadius() {
		return 1;
	}
	
	circleRadius() {
		return 1;
	}
	
	draw(offsetAngle, isOverlay) {
		let raster = new paper.Raster(this.e.name);
		return raster;
	}
	
	copy() {
		return new ElementCircle(this.e);
	}
}

class CompoundCircle {	
	constructor(subcircles, overlay, amp=1) {
		this.subcircles = subcircles;
		this.overlay = overlay;
		this.amp = amp;
		this.elem = false;
	}
	
	get size() {
		return this.subcircles.length;
	}
	
	maxSubRadius() {
		// Maximum radius of a subcircle
		let result = 1; // By default, assume empty slots are elementals
		for (const sub of this.subcircles) {
			if (sub !== null) {
				result = Math.max(result, sub.radius);
			}
		}
		return result;
	}
	
	maxSubRadiusCircle() {
		// Maximum circle radius of a subcircle, mostly used for overlays
		let result = 0;
		for (const sub of this.subcircles) {
			if (sub !== null) {
				result = Math.max(result, sub.circleRadius());
			}
		}
		return result;
	}
	
	mainRadius() {
		// Radius at which the component circles are placed
		
		// Firstly, the subcircles can't intersect, and ideally shouldn't be close to intersecting
		let result = (this.maxSubRadius()+1) / Math.sin(Math.PI/this.size);
		
		// If there is an override or overlay, there has to be space for it
		if (this.overlay !== null) {
			if (this.overlay.elem) {
				// Override: leave some space between it and the subcircles
				result = Math.max(result, 2 + this.maxSubRadius());
			}
			else {
				// Override: circles of subcircles must exactly touch it, ignore everything else
				result = this.overlay.radius;
			}
		}
		
		return result;
	}
	
	circleRadius() {
		// Radius of the circle container, equal to mainRadius plus amplification
		return this.mainRadius() * this.amp;
	}
	
	get radius() {
		// Radius of the full circle
		return Math.max(this.mainRadius() + this.maxSubRadius(), this.circleRadius());
	}
	
	draw(offsetAngle, isOverlay) {
		// Draw the actual circle
		let circleR = this.circleRadius()*R;
		let circleBB = new paper.Rectangle(new paper.Point(-circleR, -circleR), new paper.Point(circleR, circleR));
		let circle = new paper.Path.Ellipse(circleBB);
		if (!isOverlay) {
			circle.fillColor = "white";
		}
		
		// Create the group
		let group = new paper.Group([circle]);
		
		// Locate the component circles
		let mainR = this.mainRadius()*R;
		let points = [];
		let subAngle = 2 * Math.PI / this.size;
		for (let i = 0; i<this.size; i++) {
			points.push(polar(mainR, i * subAngle + offsetAngle));
		}
		
		// Locate the center
		let center = new paper.Point(0,0);
		
		// Draw the connecting lines
		let phi = Math.acos(Math.cos(subAngle/2) / this.amp); // This is the half-angle of each of the connector lines
		for (let i = 0; i<this.size; i++) {
			group.addChild(new paper.Path([
				polar(circleR, (i + 0.5) * subAngle + offsetAngle - phi),
				polar(circleR, (i + 0.5) * subAngle + offsetAngle + phi)
			]));
		}
		
		// Draw the override, if one exists
		if (this.overlay !== null) {
			
			// If it's an override, draw the connecting lines
			if (this.overlay.elem) {
				for (let i = 0; i<this.size; i++) {
					group.addChild(new paper.Path([center, points[i]]));
				}
			}
			
			// Draw the overlaying circle
			let overlayImage = this.overlay.draw(offsetAngle+Math.PI/this.size, true);
			
			/*
			// If it's an overlay, make it transparent (so this circle's connectors can be seen)
			if (!this.overlay.elem) {
				overlayImage.firstChild.fillColor = null;
			}
			*/
			
			// Position and add to group
			overlayImage.position = center;
			group.addChild(overlayImage);
		}
		let isOverlaid = (this.overlay !== null) && (!this.overlay.elem);
		
		// Draw the component circles
		// TODO: a dash for null circles
		for (let i = 0; i<this.size; i++){
			let sub = this.subcircles[i];
			let point = points[i];
			let subImage = sub.draw(offsetAngle, false);
			if (isOverlaid) {
				// If this circle has an overlay: all subcircles must be scaled to match the radius of the overlay's subcircles
				let targetRadius = this.overlay.maxSubRadiusCircle();
				subImage.scale(targetRadius / sub.circleRadius());
			}
			else if (isOverlay) {
				// If this circle is an overlay: all subcircles must be scaled to match the radius of its own largest subcircle
				let targetRadius = this.maxSubRadiusCircle();
				subImage.scale(targetRadius / sub.circleRadius());
			}
			subImage.position = point;
			group.addChild(subImage);
		}
		
		// Add color, return group
		group.strokeColor = "black";
		group.strokeWidth = LINE_WIDTH;
		group.pivot = center;
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
		return new CompoundCircle(subcircles, overlay, this.amp);
	}
}

class CircleArray {	
	constructor(subcircles, conduits) {
		this.subcircles = subcircles;
		this.conduits = conduits;
		this.elem = false;
	}
	
	get size() {
		return this.subcircles.length;
	}
	
	maxSubRadius() {
		// Maximum radius of a subcircle
		let result = 1; // By default, assume empty slots are elementals
		for (const sub of this.subcircles) {
			if (sub !== null) {
				result = Math.max(result, sub.radius);
			}
		}
		return result;
	}
	
	mainRadius() {
		// Radius at which the component circles are placed
		
		return (this.maxSubRadius()+1) / Math.sin(Math.PI/this.size);
	}
	
	get radius() {
		// Radius of the full circle
		return this.mainRadius() + this.maxSubRadius();
	}
	
	draw(offsetAngle, isOverlay) {
		// Create the group
		let group = new paper.Group([]);
		
		// Locate the component circles
		let mainR = this.mainRadius()*R;
		let points = [];
		let subAngle = 2 * Math.PI / this.size;
		for (let i = 0; i<this.size; i++) {
			points.push(polar(mainR, i * subAngle + offsetAngle));
		}
		
		// Locate the center
		let center = new paper.Point(0,0);
		
		// Draw the connecting lines
		for (let i = 0; i<this.size; i++) {
			let line = new paper.Path([points.at(i-1), points.at(i)]);
			if (this.conduits[i]) {
				let shift = polar(COND_WIDTH/2, (i - 0.5) * subAngle + offsetAngle)
				let line2 = line.clone();
				line.translate(shift);
				line2.translate(shift.multiply(-1));
				group.addChild(line);
				group.addChild(line2);
			}
			else {
				group.addChild(line);
			}
		}
		
		// Draw the component circles
		// TODO: a dash for null circles
		for (let i = 0; i<this.size; i++){
			let sub = this.subcircles[i];
			let point = points[i];
			let subImage = sub.draw(offsetAngle, false);
			subImage.position = point;
			group.addChild(subImage);
		}
		
		// Add color, return group
		group.strokeColor = "black";
		group.strokeWidth = LINE_WIDTH;
		group.pivot = center;
		return group;
	}
	
	copy() {
		let subcircles = [];
		for (const sub of this.subcircles) {
			subcircles.push(sub.copy());
		}
		return new CircleArray(subcircles, Array.from(this.conduits));
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
	// console.log(string);
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
	
	// If trailing is + or ++, record amp and recurse
	if (string.endsWith("+")) {
		if (string.endsWith("++")) {
			let result = parseShorthand(string.substring(0, string.length-2));
			result.amp = 3;
			return result;
		}
		else {
			let result = parseShorthand(string.substring(0, string.length-1));
			result.amp = 2;
			return result;
		}
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

function parseArray(string) {
	// Attempt to correct some common omissions in array writing
	if (string.endsWith("=")) {
		string = "=" + string;
	}
	else if (string.endsWith("-")) {
		string = "-" + string;
	}
	else if (string.includes("-") || string.includes("=")) {
		string = "-" + string + "-";
	}
	
	let parts = Array.from(string.matchAll(/([-=])([^-=]+)/g));
	if (parts.length > 0) {
		return new CircleArray(
			parts.map(x => parseShorthand(x[2])),
			parts.map(x => x[1] === "=")
		)
	}
	else {
		return parseShorthand(string);
	}
}

window.onload = function() {
	// Connect to canvas
	canvas = document.getElementById("canvas");
	paper.setup(canvas);
	
	// If resize is set, the canvas size tags are ignored if element size is specified
	// If resize is not set, the canvas size always matches the element size
	// Setting the size programmatically, while odd, is my only means of actually doing supersampling
	// It also leads to a flicker of incorrect size at the start, ugh
	let viewRadius = 4000;
	paper.view.viewSize = new paper.Size(viewRadius, viewRadius);
	canvas.style.height = "70vmin";
	canvas.style.width = "70vmin";
	
	// Create variables
	circle = null;
	render = null;
	
	// Make the background
	let background = new paper.Path.Rectangle(paper.view.viewSize);
	background.fillColor = "white";
	
	// Function definitions
	
	redraw = function() {
		// Clear render (if necessary)
		if (render) {
			render.remove();
		}
		
		// Draw the circle
		render = circle.draw(0, false);
		
		// let viewBounds = paper.view.bounds;
		// let targetRadius = Math.min(viewBounds.width, viewBounds.height)/2;
		// let renderRadius = circle.radius*R;
		// console.log(targetRadius);
		// console.log(renderRadius);
		// render.scale(targetRadius/renderRadius);
		
		// Rescale and position render
		let viewBounds = paper.view.bounds;
		let rendBounds = render.bounds;
		let factor = Math.min(viewBounds.width/rendBounds.width, viewBounds.height/rendBounds.height);
		render.scale(factor);
		render.translate(paper.view.center.subtract(render.bounds.center));
		paper.view.draw();
	}
	
	showCircle = function(c) {
		circle = c;
		redraw();
	}

	paper.view.onResize = function(event) {
		redraw();
	}
	
	// Below functions are specific to the "tech demo" and may be changed in the full version

	download = function(filename){
		var link = document.createElement('a');
		link.download = filename + ".png";
		link.href = document.getElementById('canvas').toDataURL()
		link.click();
	}
	
	convert = function() {
		let inputText = document.getElementById("inputText").value.replaceAll(" ", "");
		try {
			showCircle(parseArray(inputText));
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
			showCircle(parseArray(inputText));
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
	
	// Initial example
	showCircle(parseArray("Ve/Pu/Bk++"));
	showStatus("Converter ready.");
}

