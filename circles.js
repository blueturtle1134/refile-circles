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

for (let i = 0; i<ELEMENTS.length; i++) {
	ELEMENTS[i].i = i;
}

// Helper method for polar coordinates
function polar(r, theta) {
	let result = new paper.Point(r * Math.sin(theta), -r * Math.cos(theta));
	return result;
}

// Helper method that takes two arrays of objects implementing .equals and checks if they are equal
function recursiveSubsetEq(set1, set2) {
	if (set1.length != set2.length) {
		return false;
	}
	let matched = Array(set1.length).fill(false);
	for (let i = 0; i<set2.length; i++) {
		let matchedThis = false;
		for (let j = 0; j<set1.length; j++) {
			if (!matched[j] && set1[j].equals(set2[i])) {
				matchedThis = true;
				matched[j] = true;
				break;
			}
		}
		if (!matchedThis) {
			return false;
		}
	}
	return matched.every(Boolean);
}

// Define classes for the circle types
class ElementCircle {
	constructor(e) {
		this.e = e;
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
	
	equals(that) {
		if (that instanceof ElementCircle) {
			return this.e == that.e;
		}
		else {
			return false;
		}
	}
}

class CompoundCircle {
	constructor(subcircles, overlay, amp=1, inverse=false) {
		this.subcircles = subcircles;
		this.overlay = overlay;
		this.amp = amp;
		this.inverse = inverse;
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
		let result;
		if (this.size === 6) {
			// If this is a 6P: calc as if 3P and double
			result = 2 * (this.maxSubRadius()+1) / Math.sin(Math.PI/3);
		}
		else {
			result = (this.maxSubRadius()+1) / Math.sin(Math.PI/this.size);
		}
		
		// If there is an override or overlay, there has to be space for it
		if (this.overlay !== null) {
			if (this.overlay instanceof ElementCircle) {
				// Override: leave some space between it and the subcircles
				if (this.size === 6) {
					// If this is a 6P, it needs to not touch the inner circles
					result = Math.max(result, 4 + 2*this.maxSubRadius());
				}
				else {
					result = Math.max(result, 2 + this.maxSubRadius());
				}
			}
			else {
				// TODO: don't try to overlay a 6P just don't
				if (this.overlay.size === this.size) {
					// Homogenous overlay: circles of subcircles must exactly touch it
					result = this.overlay.circleRadius() + this.overlay.maxSubRadiusCircle();
				}
				else {
					// Heterogenous overlay: circle of overlay touches connectors of base
					result = this.overlay.circleRadius() / Math.cos(Math.PI / this.size);
				}
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
			if (this.size === 6 && i%2 === 1) {
				// For a 6P circle, the odd points are amplified
				points.push(polar(mainR/2, i * subAngle + offsetAngle));
			}
			else {
				points.push(polar(mainR, i * subAngle + offsetAngle));
			}
		}
		
		// Locate the center
		let center = new paper.Point(0,0);
		
		if (this.inverse) {
			// Draw the inverse aspect, rather than the connectors
			switch (this.size) {
				case 3:
					for (let i = 0; i<3; i++) {
						group.addChild(new paper.Path([center, points[i]]));
					}
					break;
			}
		}
		else {
			// Draw the connecting lines
			if (this.size === 6) {
				// 6P has a special connector setup
				
				// Draw the three outer lines
				let phi = Math.acos(0.5 / this.amp);
				// Since the 6P shape is treated as unamplified, further amplifying is possible as normal, even though this doesn't actually make sense
				for (let i = 0; i<3; i++) {
					group.addChild(new paper.Path([
						polar(circleR, (i + 0.5) * Math.PI*2/3 + offsetAngle - phi),
						polar(circleR, (i + 0.5) * Math.PI*2/3 + offsetAngle + phi)
					]));
				}
				
				// Connect the inner points
				group.addChild(new paper.Path([points[1], points[3], points[5], points[1]]));
			}
			else {
				let phi = Math.acos(Math.cos(subAngle/2) / this.amp); // This is the half-angle of each of the connector lines
				for (let i = 0; i<this.size; i++) {
					group.addChild(new paper.Path([
						polar(circleR, (i + 0.5) * subAngle + offsetAngle - phi),
						polar(circleR, (i + 0.5) * subAngle + offsetAngle + phi)
					]));
				}
			}
		}
		
		// Draw the override, if one exists
		if (this.overlay !== null) {
			
			// If it's an override and an inverse, draw the connecting lines
			if ((this.overlay instanceof ElementCircle) && !this.inverse) {
				for (let i = 0; i<this.size; i++) {
					if (!(this.size === 6 && i%2 === 1)) { // 6P only has half the override connectors
						group.addChild(new paper.Path([center, points[i]]));
					}
				}
			}
			
			// Draw the overlaying circle
			let overlayImage = this.overlay.draw(offsetAngle+Math.PI/this.overlay.size, true);
			
			// Position and add to group
			overlayImage.position = center;
			group.addChild(overlayImage);
		}
		let isOverlaid = (this.overlay !== null) && (!(this.overlay instanceof ElementCircle));
		
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
	
	equals(that) {
		if (that instanceof CompoundCircle) {
			// TODO finish equalizer
		}
		else {
			return false;
		}
	}
}

class CircleArray {
	constructor(subcircles, conduits) {
		this.subcircles = subcircles;
		this.conduits = conduits;
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
		
	equals(that) {
		if (that instanceof CompoundCircle) {
			// TODO finish equalizer
		}
		else {
			return false;
		}
	}
}

// Functions for notation parsing
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
	
	// Split on inverse symbol, if it exists, and recurse
	let debangs = searchOutsideParens(string, "\u00A1");
	if (debangs.length > 0) {
		let last = debangs.at(-1);
		let left = parseShorthand(string.substring(0, last));
		let right = parseShorthand(string.substring(last+1));
		right.overlay = left;
		right.inverse = true;
		return right;
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

// Cost calculation
class CostProfile {
	constructor (affinity, attunement) {
		this.affinity = affinity;
		this.attunement = attunement;
	}
}

const EMPTY_PROFILE = new CostProfile(Array(ELEMENTS.length).fill(false), Array(ELEMENTS.length).fill(false));

function fullCost(circle, caster=EMPTY_PROFILE) {
	if (circle instanceof CircleArray) {
		let result = 0;
		for (c of circle.subcircles) {
			result += fullCost(c, caster);
		}
		return result;
	}
	else {
		return Math.max(1, Math.floor(cost(circle, caster)));
	}
}

/** Checks if a CompoundCircle fits the "all but one" affinity discount condition. */
function allButOne(circle, caster) {
	let counts = Array(ELEMENTS.length).fill(0);
	for (subcircle of circle.subcircles) {
		if (subcircle instanceof ElementCircle) {
			counts[subcircle.e.i]++;
		}
		else {
			// I *believe* a single non-elementary shuts off this condition
			return false;
		}
	}
	for (let i = 0; i<counts.length; i++) {
		if (counts[i] == circle.subcircles.length-1 && caster.affinity[i]) {
			return true;
		}
	}
	return false;
}

function cost(circle, caster=EMPTY_PROFILE, discounted=false, multiplier=1) {
	if (circle instanceof ElementCircle) {
		if (!discounted && caster.affinity[circle.e.i]) {
			discounted = true;
		}
		if (caster.attunement[circle.e.i]) {
			return 1/(discounted+1);
		}
		else {
			return circle.e.cost*multiplier/(discounted+1);
		}
	}
	else { // It must be a compound circle
		let result = 0;
		multiplier *= circle.amp;
		if (circle.overlay != null) {
			if (circle.overlay instanceof ElementCircle) {
				if (!discounted && caster.affinity[circle.overlay.e.i]) {
					discounted = true;
				}
				result += cost(circle.overlay, caster, discounted, multiplier*4);
			}
			else if (circle.overlay instanceof CompoundCircle) {
				result += cost(circle.overlay, caster, discounted, multiplier*2)
			}
			else { // It is a numerical value representing an overwrite
				multiplier *= Math.floor(circle.overlay/2);
			}
		}
		if (!discounted && allButOne(circle, caster)) {
			discounted = true;
		}
		for (c of circle.subcircles) {
			result += cost(c, caster, discounted, multiplier);
		}
		return result;
	}
}

// Affinity and attunement information
// this is honestly kind of scuffed, I feel like it should be objects
PRESETS = [
	["Player Characters",[
		["Sariel", "In Sv", "In Sv"],
		["Tamar", "Rd Sv Mc Bu", "Sv Rd"],
		["Morgan", "Wh Bg Pk Gd", "Bg Pk"],
		["cHarriett", "Yw Sk Pk Gy", "Gy Yw"],
		["Ezra", "Gn Pk", ""],
		["Clyde", "Tr Br", "Br"],
		["Zoe", "In", ""],
		["Alex", "Tr Sk Pu", "Sk"],
		["Julian", "", ""],
		["Peter", "", ""]
	]]
]
