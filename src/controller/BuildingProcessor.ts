import parse5, {Document} from "parse5";
import JSZip from "jszip";
import {InsightError} from "./IInsightFacade";
import * as http from "http";
import {RoomsSection} from "./ICourseSection";

export interface BuildingInfo {
	fullname: string;
	shortname: string;
	address: string;

	lat: number;
	lon: number;
	href: string;
}


export default class BuildingProcessor {

	private buildingHrefClass: string = "views-field-title";
	private buildingShortnameClass: string = "views-field-field-building-code";
	private buildingAddressClass: string = "views-field-field-building-address";
	private geolocationQueryBase: string = "http://cs310.students.cs.ubc.ca:11316/api/v1/project_team149/"
	private roomsFurnitureClass = "views-field-field-room-furniture";
	private roomsRoomNumberClass = "views-field-field-room-number";
	private roomsRoomTypeClass = "views-field-field-room-type";
	private roomCapacityClass = "views-field-field-room-capacity";
	private roomHrefClass = "views-field-field-room-number";
	private buildingFullnameClass = "views-field-title";

	// so far we are getting short name, long name, address, and href to other file

	public async getBuildingInfo(buildingDocument: Document): Promise<BuildingInfo[]> {
		let tableRows: any = [];
		this.getTableBodyRowNodes(buildingDocument, tableRows);
		let buildings: BuildingInfo[] = [];
		for (const row of tableRows) {
			let building = {} as BuildingInfo;
			building.href = this.getHrefWithClassname(row, this.buildingHrefClass);
			if (building.href) {
				building.shortname = this.getNodeWithClassname(row, this.buildingShortnameClass);
				building.address = this.getNodeWithClassname(row, this.buildingAddressClass);
				building.fullname = this.getTextFromAttributeNodeWithClass(row, this.buildingFullnameClass);
				let response = await this.getGeoResponse(building.address).catch((err) => console.log(err));
				if(response.error !== undefined){
					continue;
				}else {
					building.lon = response.lon;
					building.lat = response.lat;
				}
				buildings.push(building);
			}
		}

		if(buildings.length > 0){
			return Promise.resolve(buildings);
		}else{
			return Promise.reject(new InsightError());
		}
	}

	public async getRoomsForBuilding(building: BuildingInfo, jszip: JSZip): Promise<RoomsSection[]> {
		// let zip = new JSZip();
		//
		let roomsInfoDir = building.href.replace(".", "rooms");
		// let jszip = await zip.loadAsync(content, {base64: true});
		//
		const htmlRoomsContent = await jszip.file(roomsInfoDir)?.async("string");

		let roomSections: RoomsSection[] = [];

		if (htmlRoomsContent) {
			const roomsDocument = parse5.parse(htmlRoomsContent);
			let tableRows: any[] = [];
			this.getTableBodyRowNodes(roomsDocument, tableRows);
			for (let row of tableRows) {
				let room = {} as RoomsSection;
				room.furniture = this.getNodeWithClassname(row, this.roomsFurnitureClass);
				room.number = this.getTextFromAttributeNodeWithClass(row, this.roomsRoomNumberClass);
				room.type = this.getNodeWithClassname(row, this.roomsRoomTypeClass);
				room.seats = this.parseSeatsToInteger(this.getNodeWithClassname(row, this.roomCapacityClass));
				room.href = this.getHrefWithClassname(row, this.roomHrefClass);
				BuildingProcessor.setBuildingInfo(room, building);
				roomSections.push(room);
			}
		}

		return Promise.resolve(roomSections);
	}

	private parseSeatsToInteger(seats: any): number {
		if (seats) {
			const seatsAsNumber = Number.parseInt(seats, 10);
			return Number.isNaN(seatsAsNumber) ? 0 : seatsAsNumber;
		}

		return 0;
	}

	private getTableBodyRowNodes(documentNode: any, tableRows: any){

		if(!documentNode){
			return null;
		}

		if(documentNode.nodeName === "tr" && documentNode.parentNode.nodeName === "tbody"){
			tableRows.push(documentNode);
		}

		if(documentNode.childNodes){
			for(let i of documentNode.childNodes){
				this.getTableBodyRowNodes(i, tableRows);
			}
		}
	}

	private getNodeWithClassname(documentNode: any, classValue: string): any{

		if(!documentNode){
			return null;
		}

		if(documentNode.nodeName){
			if(documentNode.nodeName === "td" && documentNode.attrs){
				for(let attr of documentNode.attrs){
					if(attr.name === "class" && attr.value.includes(classValue)){
						let x = BuildingProcessor.getTextFromChildNodes(documentNode);
						if(x){
							return x;
						}
					}
				}
			}
		}

		if (documentNode.childNodes) {
			for(let i of documentNode.childNodes) {
				let x = this.getNodeWithClassname(i, classValue);
				if(x){
					return x;
				}
			}
		}

		return null;

	}

	private static getTextFromChildNodes(documentNode: any): any{
		if(!documentNode){
			return null;
		}
		if(documentNode.childNodes){
			for(let child of documentNode.childNodes){
				if(child.nodeName === "#text"){
					if(child.value.trim()){
						return child.value.trim();
					}
				}
			}
		}
		return null;
	}

	private getAttributeNode(documentNode: any, parentClass: string): any{

		if(!documentNode){
			return null;
		}

		if(documentNode.nodeName){
			if(documentNode.nodeName === "a"){
				if(BuildingProcessor.checkParentNodeClassName(documentNode.parentNode, parentClass)){
					if(documentNode.attrs){
						for(let attr of documentNode.attrs){
							if(attr.name === "href"){
								return documentNode;
							}
						}
					}
				}
			}
		}

		if (documentNode.childNodes) {
			for(let i of documentNode.childNodes) {
				let x = this.getAttributeNode(i, parentClass);
				if(x){
					return x;
				}
			}
		}

		return null;
	}

	private getHrefWithClassname(documentNode: any, parentClassName: string): any{

		if(!documentNode){
			return null;
		}

		let attributeNode = this.getAttributeNode(documentNode, parentClassName);

		if(!attributeNode){
			return null;
		}

		if(attributeNode.attrs){
			for(let attr of attributeNode.attrs){
				if(attr.name === "href"){
					return attr.value;
				}
			}
		}

		return null;
	}

	private getTextFromAttributeNodeWithClass(documentNode: any, parentClassName: string): any{
		return BuildingProcessor.getTextFromChildNodes(this.getAttributeNode(documentNode, parentClassName));
	}

	private static checkParentNodeClassName(documentNode: any, parentClassName: string): boolean{
		if(documentNode){
			if(documentNode.attrs) {
				for (let attr of documentNode.attrs) {
					if (attr.name === "class" && attr.value.includes(parentClassName)) {
						return true;
					}
				}
			}
		}

		return false;
	}

	private getGeoResponse(address: string): Promise<any> {
		let requestAddress = this.geolocationQueryBase + address;
		if(address){
			requestAddress = requestAddress.replace(/\s/g, "%20");
		}

		return new Promise((resolve, reject) => {

			const getRequest = http.get(requestAddress, (resp) => {
				let body = "";
				resp.on("data", ((chunk) => body += chunk));

				// TODO: add error handling

				resp.on("end", () => {
					body = JSON.parse(body);
					resolve(body);
				});

			});

			getRequest.on("error", (err) => {
				reject(err.message);
			});

			getRequest.end();
		});

	}


	private static setBuildingInfo(room: RoomsSection, building: BuildingInfo){
		room.lat = building.lat;
		room.lon = building.lon;
		room.fullname = building.fullname ?? "";
		room.shortname = building.shortname ?? "";
		room.name = ((building.shortname) ? building.shortname + "_" + room.number : "");
		room.address = building.address ?? "";
		if(!room.type){
			room.type = "";
		}
		if(!room.furniture){
			room.furniture = "";
		}
		if(!room.href){
			room.href = "";
		}
	}
}
