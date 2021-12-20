document.getElementById("course-submit").addEventListener("click", sendCoursesQueryRequest);
document.getElementById("instructors-submit").addEventListener("click", sendInstructorsQueryRequest);

function sendInstructorsQueryRequest(){
	console.log("sending query");
	var xhr = new XMLHttpRequest();
	var instructorFirstName = document.getElementById("instructors-input").value.split(' ')[0].toLowerCase();
	var instructorLastName = document.getElementById("instructors-input").value.split(' ')[1].toLowerCase();
	var queryFormattedInstructorName = instructorLastName + ", " + instructorFirstName;
	console.log(queryFormattedInstructorName);


	let queryURL = "/query"
	xhr.open("POST", queryURL, true);
	xhr.setRequestHeader('Content-Type', 'application/json');
	xhr.send(JSON.stringify({
		"WHERE": {
			"IS": {
				"courses_instructor": queryFormattedInstructorName
			}
		},
		"OPTIONS": {
			"COLUMNS": [
				"courses_dept",
				"courses_id",
				"courses_avg",
				"courses_year"
			],
			"ORDER": "courses_year"
		}
	}));

	xhr.onreadystatechange = function () {

		if (this.readyState !== 4) return;

		if (this.status === 200) {
			var data = JSON.parse(this.responseText);
			if(data.result.length === 0){
				changeNodeValue('instructors-response-node', "Error! Invalid input");
				return;
			}
			console.log(data);
			var tableNode = processInstructorTable(data.result);
			var respondeNode = document.getElementById("instructors-response-node");
			respondeNode.replaceWith(tableNode);
			tableNode.id = "instructors-response-node";
			// we get the returned data
		}if(this.status === 400 || this.status === 404){
			changeNodeValue('instructors-response-node', "Error! Invalid input");
		}
	};
}

function processInstructorTable(result){

	var tableNode = document.createElement('table');
	let columnNames = ["Department", "Course Number", "Course Average", "Year"];
	generateTableHead(tableNode, columnNames);
	populateTable(tableNode, result);

	return tableNode;
}

function generateTableHead(table, columnNames){
	let thead = table.createTHead();
	let row = thead.insertRow();
	for (let key of columnNames) {
		let th = document.createElement("th");
		let text = document.createTextNode(key);
		th.appendChild(text);
		row.appendChild(th);
	}
	console.log(table);
}

function populateTable(table, data) {
	for (let element of data) {
		let row = table.insertRow();
		for (key in element) {
			let cell = row.insertCell();
			let text = document.createTextNode(element[key]);
			cell.appendChild(text);
		}
	}
}

function sendCoursesQueryRequest() {
	console.log("sending query");
	var xhr = new XMLHttpRequest();
	var courseDept = document.getElementById("courses-input").value.split(' ')[0].toLowerCase();
	console.log(courseDept);
	var courseNumber = document.getElementById("courses-input").value.split(' ')[1];
	console.log(courseNumber);


	let queryURL = "/query"
	xhr.open("POST", queryURL, true);
	xhr.setRequestHeader('Content-Type', 'application/json');
	xhr.send(JSON.stringify({
		"WHERE": {
			"AND": [
				{
					"IS": {
						"courses_dept": courseDept
					}
				},
				{
					"IS": {
						"courses_id": courseNumber
					}
				}
			]
		},
		"OPTIONS": {
			"COLUMNS": [
				"courses_title",
				"numPassed",
				"numFailed"
			]
		},
		"TRANSFORMATIONS": {
			"GROUP": [
				"courses_title"
			],
			"APPLY": [
				{
					"numPassed": {
						"SUM": "courses_pass"
					}
				},
				{
					"numFailed": {
						"SUM": "courses_fail"
					}
				}
			]
		}
	}));

	xhr.onreadystatechange = function () {

		if (this.readyState !== 4) return;

		if (this.status === 200) {
			var data = JSON.parse(this.responseText);
			if(data.result.length === 0){
				changeNodeValue('courses-response-node', "Error! Invalid input");
				return;
			}
			console.log(data);
			var percentFail = ((data.result[0].numFailed/(data.result[0].numFailed + data.result[0].numPassed)) * 100).toFixed(2);
			const percentFailMessage = percentFail + "% of students fail " + document.getElementById("courses-input").value.toUpperCase() + generateCoursesResponseMessage(percentFail);
			changeNodeValue('courses-response-node', percentFailMessage);

			// we get the returned data
		}if(this.status === 400 || this.status === 404){
			changeNodeValue('courses-response-node', "Error! Invalid input");
		}
	};
}

function changeNodeValue(nodeName, content){
	node = document.getElementById(nodeName);
	node.textContent = content;
}

function generateCoursesResponseMessage(percentFail) {
	if (percentFail > 10) {
		return ", eek! run away!";

	} else if (percentFail > 5) {
		return ", proceed with caution.";
	}

	return ", you'll be fine!";


}


