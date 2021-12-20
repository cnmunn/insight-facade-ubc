import BuildingProcessor, {BuildingInfo} from "./BuildingProcessor";
import {RoomsSection} from "./ICourseSection";
import JSZip from "jszip";
import parse5, {Document} from "parse5";

export default class RoomProcessor{
	private building: BuildingInfo;
	private roomsDocument: Document;
	private roomsFurnitureClass = "views-field-field-room-furniture";
	private roomsRoomNumberClass = "views-field-field-room-number";
	private roomsRoomTypeClass = "views-field-field-room-type";
	private roomCapacityClass = "views-field-field-room-capacity";
	private rooms: RoomsSection[] = [];

	constructor(building: BuildingInfo, roomsDocument: Document) {
		this.building = building;
		this.roomsDocument = roomsDocument;
	}

	private getRoomsFromBuilding(){
		let roomsInfoDir = this.building.href.replace(".", "rooms");
		let tableRows: any[] = [];

		// TODO: add default variable if null
		this.getTableBodyRowNodes(this.roomsDocument, tableRows);
		for(let row of tableRows) {
			let room = {} as RoomsSection;
			room.furniture = this.getBuildingTextValue(row, this.roomsFurnitureClass);
			room.number = this.getBuildingTextValue(row, this.roomsRoomNumberClass);
			room.type = this.getBuildingTextValue(row, this.roomsRoomTypeClass);
			room.seats = this.getBuildingTextValue(row, this.roomCapacityClass);
			this.setBuildingInfo(room);
			this.rooms.push(room);
		}
	}

	private getTableBodyRowNodes(documentNode: any, tableRows: any){

		if(documentNode.nodeName === "tr" && documentNode.parentNode.nodeName === "tbody"){
			tableRows.push(documentNode);
		}

		if(documentNode.childNodes){
			for(let i of documentNode.childNodes){
				this.getTableBodyRowNodes(i, tableRows);
			}
		}
	}

	private getBuildingTextValue(documentNode: any, classValue: string): any{

		if(documentNode.nodeName){
			if(documentNode.nodeName === "td" && documentNode.attrs){
				for(let attr of documentNode.attrs){
					if(attr.name === "class" && attr.value.includes(classValue)){
						let x = this.getTextFromChildNodes(documentNode);
						if(x){
							return x;
						}
					}
				}
			}
		}

		if (documentNode.childNodes) {
			for(let i of documentNode.childNodes) {
				let x = this.getBuildingTextValue(i, classValue);
				if(x){
					return x;
				}
			}
		}

		return null;

	}

	private getTextFromChildNodes(documentNode: any): any{
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

	private setBuildingInfo(room: RoomsSection){
		room.address = this.building.address;
		room.name = this.building.fullname;
		room.shortname = this.building.shortname;
		room.href = this.building.href;
		room.lat = this.building.lat;
		room.lon = this.building.lon;
		room.shortname = this.building.shortname + " " + room.number;
	}

	public getRooms(): RoomsSection[]{
		this.getRoomsFromBuilding();
		return this.rooms;
	}

}
