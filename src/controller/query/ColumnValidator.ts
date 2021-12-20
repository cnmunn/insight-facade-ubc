import {InsightDatasetKind} from "../IInsightFacade";
import DatasetManager from "../DatasetManager";

export class ColumnValidator {
	public get dataset(): string {
		return this._dataset;
	}

	public get columns(): string[] {
		return this._columns;
	}

	public get groupKeys(): string[] {
		return this._groupKeys;
	}

	private datasetManager: DatasetManager;

	private _dataset: string = "";
	private datasetKind: InsightDatasetKind | undefined;

	private _columns: string[] = [];
	private readonly _applyKeys: Set<string> = new Set<string>();
	private _groupKeys: string[] = [];

	public constructor(datasetManager: DatasetManager) {
		this.datasetManager = datasetManager;
	}

	// Returns true if applyKey is a string AND is non-empty, non-all whitespace, and contains no underscores
	// AND is not a duplicate of previous applyKeys
	// Adds the string to applyKeys if it's valid.
	public isValidApplyKey(applyKey: unknown): boolean {
		if (typeof applyKey === "string" && this.isNonEmptyAndHasNoUnderscores(applyKey)) {
			if (!this._applyKeys.has(applyKey)) {
				this._applyKeys.add(applyKey);
				return true;
			}
		}

		return false;
	}

	public isValidGroupKeys(groupKeys: unknown): boolean {
		const valid = Array.isArray(groupKeys)
			&& groupKeys.length > 0
			&& groupKeys.every((element) => this.isValidKey(element));

		if (valid) {
			this._groupKeys = groupKeys;
		}
		return valid;
	}

	// Returns true if the COLUMNS is a non-empty array of keys (if groupingKeys not specified)
	// OR groupingKeys and applyKeys (if groupingKeys specified)
	public isValidColumns(columns: unknown): columns is string[] {
		let valid = false;

		if (Array.isArray(columns) && columns.length > 0) {
			if (this._groupKeys.length > 0) {
				valid = this.isValidColumnsGrouped(columns);

				if (valid) {
					this._columns = columns;
				}
			} else {
				valid = this.isValidColumnsUngrouped(columns);

				if (valid) {
					this._columns = columns;
				}
			}
		}

		return valid;
	}

	private isValidColumnsUngrouped(columns: unknown[]): columns is string[] {
		return columns.every((column) => this.isValidKey(column));
	}

	private isValidColumnsGrouped(columns: unknown[]): columns is string[] {
		return columns.every((column) => this.isValidColumnGrouped(column));
	}

	private isValidColumnGrouped(column: unknown): column is string {
		return typeof column === "string"
			&& (this._groupKeys.includes(column) || this._applyKeys.has(column));
	}

	public isValidSortKeys(sortKeys: unknown): sortKeys is string[] {
		return Array.isArray(sortKeys)
			&& sortKeys.length > 0
			&& sortKeys.every((element) => this.isValidSortKey(element));
	}

	public isValidSortKey(sortKey: unknown): sortKey is string {
		return typeof sortKey === "string" && this._columns.includes(sortKey);
	}

	// Returns true if the key is a valid key i.e. it is a string and has the form of a valid mkey or skey
	public isValidKey(key: unknown): key is string {
		return this.isValidMKey(key) || this.isValidSKey(key);
	}

	// Returns true if the key is a valid mkey i.e. it is a string, and is composed of a valid idstring, an underscore, and an mfield
	public isValidMKey(key: unknown): key is string {
		if (typeof key !== "string") {
			return false;
		}

		const idStringAndField = key.split("_");

		return idStringAndField.length === 2
			&& this.isValidIdString(idStringAndField[0])
			&& this.isValidMField(idStringAndField[1]);
	}

	// Returns true if the key is a valid skey i.e. it is a string, and is composed of a valid idstring, an underscore, and an sfield
	public isValidSKey(key: unknown): key is string {
		if (typeof key !== "string") {
			return false;
		}

		const idStringAndField = key.split("_");

		return idStringAndField.length === 2
			&& this.isValidIdString(idStringAndField[0])
			&& this.isValidSField(idStringAndField[1]);
	}

	// Returns true if the idString doesn't contain underscores, is non-empty, is not all whitespace,
	// and matches the current dataset if one is stored
	private isValidIdString(idString: string): boolean {
		if (!this._dataset) {
			this.setDataset(idString);
		}

		return this.isNonEmptyAndHasNoUnderscores(idString) && idString === this._dataset;
	}

	private setDataset(id: string) {
		this.datasetKind = this.datasetManager.getKindOfDataset(id);
		this._dataset = id;
	}

	private isValidMField(field: string): boolean {
		switch (this.datasetKind) {
			case InsightDatasetKind.Courses:
				return this.isCoursesMField(field);
			case InsightDatasetKind.Rooms:
				return this.isRoomsMField(field);
			default:
				console.warn("No dataset kind specified in isValidMField!");
				return false;
		}
	}

	private isValidSField(field: string): boolean {
		switch (this.datasetKind) {
			case InsightDatasetKind.Courses:
				return this.isCoursesSField(field);
			case InsightDatasetKind.Rooms:
				return this.isRoomsSField(field);
			default:
				console.warn("No dataset kind specified in isValidSField!");
				return false;
		}
	}

	private isCoursesMField(field: string): boolean {
		return ["avg", "pass", "fail", "audit", "year"].includes(field);
	}

	private isCoursesSField(field: string): boolean {
		return ["dept", "id", "instructor", "title", "uuid"].includes(field);
	}

	private isRoomsMField(field: string): boolean {
		return ["lat", "lon", "seats"].includes(field);
	}

	private isRoomsSField(field: string): boolean {
		return ["fullname", "shortname", "number", "name", "address", "type", "furniture", "href"].includes(field);
	}

	// Returns true if the input is non-empty, is not all whitespace, and contains no underscore
	private isNonEmptyAndHasNoUnderscores(str: string): boolean {
		return str.trim().length > 0 && !str.includes("_");
	}
}
