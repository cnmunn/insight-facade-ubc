import {ColumnValidator} from "./ColumnValidator";

export default class QueryValidator {
	private readonly query: unknown;
	private columnValidator: ColumnValidator;

	public constructor(query: unknown, columnValidator: ColumnValidator) {
		this.query = query;

		this.columnValidator = columnValidator;
	}

	// Returns true if the QUERY object is valid: has a valid WHERE and valid OPTIONS and optionally a valid TRANSFORMATIONS
	public checkValidQuery(): boolean {
		const queryObj = this.query;

		if (this.isObject(queryObj)) {
			if (Object.keys(queryObj).length === 2) {
				return this.containsValidBody(queryObj)
					&& this.containsValidOptions(queryObj);
			} else if (Object.keys(queryObj).length === 3) {
				// FIXME: the order in which these are checked matters! It should be body -> transformations -> options
				return this.containsValidBody(queryObj)
					&& this.containsValidTransformations(queryObj)
					&& this.containsValidOptions(queryObj);
			}
		}
		return false;
	}

	private containsValidBody(queryObj: UnknownObject): boolean {
		return "WHERE" in queryObj && this.isValidBody(queryObj["WHERE"]);
	}

	private containsValidTransformations(queryObj: UnknownObject): boolean {
		return "TRANSFORMATIONS" in queryObj && this.isValidTransformations(queryObj["TRANSFORMATIONS"]);
	}

	private containsValidOptions(queryObj: UnknownObject): boolean {
		return "OPTIONS" in queryObj && this.isValidOptions(queryObj["OPTIONS"]);
	}

	// Returns true if the BODY (object with the key "WHERE") has the correct structure
	// i.e. it is an object, and is either empty or has 1 property which must be a valid filter
	private isValidBody(bodyObj: unknown): boolean {
		return this.isObject(bodyObj)
			&& (Object.keys(bodyObj).length === 0 || this.isValidFilter(bodyObj));
	}

	private isValidFilter(filterObj: UnknownObject): boolean {
		const filterObjKeys = Object.keys(filterObj);
		if (filterObjKeys.length !== 1) {
			return false;
		}

		const filterName = filterObjKeys[0];

		switch (filterName) {
			case "LT":	// fallthrough
			case "GT":	// fallthrough
			case "EQ": {
				return this.isValidMComparison(filterObj[filterName]);
			}
			case "IS": {
				return this.isValidSComparison(filterObj[filterName]);
			}
			case "AND":	// fallthrough
			case "OR": {
				return this.isValidFilterArray(filterObj[filterName]);
			}
			case "NOT": {
				const subFilter = filterObj[filterName];
				return this.isObject(subFilter) && this.isValidFilter(subFilter);
			}
			default: {
				return false;
			}
		}
	}

	private isValidMComparison(filterObj: unknown): boolean {
		if (this.isObjectWithOneKey(filterObj)) {

			const mKey = Object.keys(filterObj)[0];
			return this.columnValidator.isValidMKey(mKey)
				&& typeof filterObj[mKey] === "number";
		}
		return false;
	}

	private isValidSComparison(filterObj: unknown): boolean {
		if (this.isObjectWithOneKey(filterObj)) {
			const sKey = Object.keys(filterObj)[0];
			const inputString: unknown = filterObj[sKey];

			return this.columnValidator.isValidSKey(sKey)
				&& typeof inputString === "string"
				&& this.isValidInputString(inputString);
		}
		return false;
	}

	private isValidFilterArray(filterArray: unknown): boolean {
		return Array.isArray(filterArray)
			&& filterArray.length > 0
			&& filterArray.every((childFilter) => typeof childFilter === "object" && this.isValidFilter(childFilter));
	}

	// Returns true if the inputString is a valid input string to an IS
	// i.e. has at most a leading and trailing asterisk, no asterisks in between
	private isValidInputString(inputString: string): boolean {
		const regexp = /^(\*)?[^*]*(\*)?$/;
		return regexp.test(inputString);
	}

	// Returns true if the OPTIONS (object with the key "OPTIONS") has the correct structure
	// i.e. it is an object, has a valid COLUMNS, optionally a valid "ORDER", and no other properties
	private isValidOptions(options: unknown): boolean {
		if (!this.isObject(options)) {
			return false;
		}

		const columnsValid = "COLUMNS" in options && this.columnValidator.isValidColumns(options["COLUMNS"]);

		switch (Object.keys(options).length) {
			case 1:
				return columnsValid;
			case 2:
				return columnsValid
					&& "ORDER" in options
					&& this.isValidSort(options["ORDER"]);
			default:
				return false;
		}
	}

	private isValidSort(order: unknown): boolean {
		if (this.columnValidator.isValidSortKey(order)) {
			return true;
		}

		return this.isObject(order)
			&& Object.keys(order).length === 2
			&& "dir" in order		// todo: remove this? can the subsequent functions check undefined for us?
			&& "keys" in order
			&& this.isValidSortDir(order["dir"])
			&& this.columnValidator.isValidSortKeys(order["keys"]);
	}

	private isValidSortDir(dir: unknown): boolean {
		return typeof dir === "string" && ["UP", "DOWN"].includes(dir);
	}

	private isValidTransformations(transformations: unknown): boolean {
		return this.isObject(transformations)
			&& Object.keys(transformations).length === 2
			&& "GROUP" in transformations
			&& "APPLY" in transformations
			&& this.columnValidator.isValidGroupKeys(transformations["GROUP"])
			&& this.isValidApply(transformations["APPLY"]);
	}

	private isValidApply(apply: unknown): boolean {
		return Array.isArray(apply)
			&& apply.every((element) => this.isValidApplyRule(element));
	}

	// Returns true if it is a valid applyRule, i.e. an object with 1 key that is a valid applyKey and a valid inner object
	private isValidApplyRule(applyRule: unknown): boolean {
		if (this.isObject(applyRule)) {
			const keys = Object.keys(applyRule);

			return keys.length === 1
				&& this.columnValidator.isValidApplyKey(keys[0])
				&& this.isValidApplyRuleInnerObject(applyRule[keys[0]]);
		}
		return false;
	}

	private isValidApplyRuleInnerObject(innerObj: unknown): boolean {
		if (this.isObjectWithOneKey(innerObj)) {
			const applyToken = Object.keys(innerObj)[0];
			const key = innerObj[applyToken];

			return this.isValidMaxMinSumAvg(applyToken, key)
				|| this.isValidCount(applyToken, key);
		}
		return false;
	}

	// Returns true if the applyToken is MAX/MIN/SUM/AVG and the column is a mKey
	private isValidMaxMinSumAvg(applyToken: string, key: unknown) {
		return ["MAX", "MIN", "AVG", "SUM"].includes(applyToken)
			&& this.columnValidator.isValidMKey(key);
	}

	// Returns true if the applyToken is COUNT and the column is a key (mKey or sKey)
	private isValidCount(applyToken: string, key: unknown) {
		return applyToken === "COUNT"
			&& this.columnValidator.isValidKey(key);
	}

	private isObject(object: unknown): object is UnknownObject {
		return !!(object && typeof object === "object");
	}

	// Returns true if the input has object type and has 1 key
	private isObjectWithOneKey(object: unknown): object is UnknownObject {
		return this.isObject(object) && Object.keys(object).length === 1;
	}
}

// TODO: Might not work. I think all JavaScript objects can be indexed by strings so...?
interface UnknownObject {
	[key: string]: unknown;
}
