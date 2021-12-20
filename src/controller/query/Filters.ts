import {CourseSection} from "../ICourseSection";

/**
 * Specifies a query over a single dataset.
 * @property {string} dataset The dataset ID of the dataset to be queried (e.g. "courses")
 * @property {string[]} columns The column names to include in the final result (e.g. ["courses_dept", "courses_avg"])
 * @property {Filter | undefined} filter The filter to apply to each section in the queried dataset
 * @property {string[]} groupColumns The columns to group by (e.g. ["dept", "avg"])
 * @property {Transformation[]} transformations The list of transformations to apply to each group. If this field is
 * present, {@link groupColumns} should be present too
 * @property {Order | undefined} order Tf present, specifies an ordering to apply to the result.
 */
export interface Query {
	dataset: string;
	columns: string[];
	filter?: Filter;
	groupColumns?: string[];
	transformations?: Transformation[];
	order?: Order;
}

/**
 * Direction to sort in (Up = ascending, Down = descending)
 */
export enum SortDirection {
	Up = "UP",
	Down = "DOWN"
}

/**
 * Specifies an ordering of query results.
 * @property {SortDirection} direction The direction to sort in
 * @property {string[]} columns The properties to sort by; ties are broken in order. Should be non-empty.
 */
export interface Order {
	direction: SortDirection;
	columns: string[];
}

export enum ApplyToken {
	Max = "MAX",
	Min = "MIN",
	Avg = "AVG",
	Count = "COUNT",
	Sum = "SUM"
}

/**
 * Specifies a single transformation to apply to a group.
 * @property {ApplyToken} applyToken The type of transformation to apply.
 * @property {string} key The property to apply the transformation to (e.g. "seats")
 * @property {string} columnName The name of the resulting column. (e.g. "maxSeats")
 */
export interface Transformation {
	applyToken: ApplyToken;
	key: string;
	columnName: string;
}

/**
 * Represents a filter that accepts or rejects objects ({@link CourseSection} or {@link RoomsSection}).
 */
export interface Filter {
	evaluateFilter(object: any): boolean;
}

/**
 * Represents a logic filter (AND, OR) which combines the results of one or more child Filters.
 */
abstract class LogicFilter implements Filter {
	protected filters: Filter[];

	/**
	 * @param filters An array of child Filters to combine. Must be NON-EMPTY.
	 */
	constructor(filters: Filter[]) {
		this.filters = filters;
	}

	/**
	 * Tests an object against this filter.
	 * @param object The object to test. Assume that it has the property {@link field}
	 */
	abstract evaluateFilter(object: any): boolean;
}

/**
 * Represents a mathematical comparison (LT, GT, EQ) of a number-type field against a value.
 */
abstract class MathFilter implements Filter {
	protected field: string;
	protected threshold: number;

	/**
	 * @param field The field whose value will be compared.
	 * @param threshold The value to compare against.
	 */
	public constructor(field: string, threshold: number) {
		this.field = field;
		this.threshold = threshold;
	}

	/**
	 * Tests an object against this filter.
	 * @param object The object to test. Assume that it has the property {@link field}
	 */
	abstract evaluateFilter(object: any): boolean;
}

/**
 * Represents a logical AND of filters.
 */
export class And extends LogicFilter {
	/**
	 * @inheritDoc
	 * @returns {boolean} True if the object tests true against ALL child filters, false otherwise.
	 */
	public evaluateFilter(object: any): boolean {
		return this.filters.every((filter: Filter) => filter.evaluateFilter(object));
	}
}

/**
 * Represents a logical OR of filters.
 */
export class Or extends LogicFilter {
	/**
	 * @inheritDoc
	 * @returns {boolean} True if the object tests true against AT LEAST ONE of the child filters, false otherwise.
	 */
	public evaluateFilter(object: any): boolean {
		return this.filters.some((filter: Filter) => filter.evaluateFilter(object));
	}
}

export class GT extends MathFilter {
	/**
	 * @inheritDoc
	 * @returns {boolean} True if the specified {@link field} of the object is strictly greater than {@link threshold}, false otherwise.
	 */
	public evaluateFilter(object: any): boolean {
		return object[this.field] > this.threshold;
	}
}

export class LT extends MathFilter {
	/**
	 * @inheritDoc
	 * @returns {boolean} True if the specified {@link field} of the object is strictly less than {@link threshold}, false otherwise.
	 */
	public evaluateFilter(object: any): boolean {
		return object[this.field] < this.threshold;
	}
}

export class EQ extends MathFilter {
	/**
	 * @inheritDoc
	 * @returns {boolean} True if the specified {@link field} of the object is equal to {@link threshold}.
	 */
	public evaluateFilter(object: any): boolean {
		return object[this.field] === this.threshold;
	}
}

/**
 * Represents a comparison of a string-type field against a string pattern.
 */
export class Is implements Filter {
	private field: string;
	private regex: RegExp;

	/**
	 * @param field The field whose value will be compared.
	 * @param matchString A string containing optional wildcards (\*) to match against. Must have the form (\*)?[^*]*(\*)?
	 */
	constructor(field: string, matchString: string) {
		this.field = field;
		this.regex = new RegExp((`^${matchString.replace(/\*/g, "(.)*")}$`));
	}

	/**
	 * Tests an object against this filter.
	 * @param object The object to test. Assume that it has the property {@link field}
	 * @returns {boolean} True if the {@link field} matches the specified string pattern, false otherwise.
	 */
	public evaluateFilter(object: any): boolean {
		return this.regex.test(object[this.field]);
	}
}

/**
 * Represents a negation of a child filter.
 */
export class Not implements Filter {
	private filter: Filter;

	/**
	 * @param filter The filter whose value will be negated.
	 */
	constructor(filter: Filter) {
		this.filter = filter;
	}

	/**
	 * Tests an object against this filter.
	 * @param object The object to test. Assume that it has the property {@link field}
	 * @returns {boolean} True if the object does not pass the child filter, false otherwise.
	 */
	public evaluateFilter(object: any): boolean {
		return !this.filter.evaluateFilter(object);
	}
}


