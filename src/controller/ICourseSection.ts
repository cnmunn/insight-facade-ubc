
// mfield ::= 'avg' | 'pass' | 'fail' | 'audit' | 'year'
// sfield ::=  'dept' | 'id' | 'instructor' | 'title' | 'uuid'

/**
 * Represents a course section.
 */
export interface CourseSection {
	dept: string;
	id: string;
	instructor: string;
	title: string;
	uuid: string;

	avg: number;
	pass: number;
	fail: number;
	audit: number;
	year: number;
}

export interface RoomsSection{
	fullname: string;
	shortname: string;
	number: string;
	name: string;
	address: string;

	lat: number;
	lon: number;
	seats: number;
	type: string;
	furniture: string;
	href: string;
}

export interface PrimitiveObject {
	[key: string]: string | number;
}
