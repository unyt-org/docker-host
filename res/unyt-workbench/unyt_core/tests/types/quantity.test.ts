import {Test} from "../../../unyt_tests/testing/test.js"
import {Assert} from "../../../unyt_tests/testing/assertions.js"
import { Quantity } from "../../datex_all.js"

/**
 * Tests for the Datex.Quantity Class
 */


var m1:Quantity.METRE = new Quantity(60,'km');
var m2:Quantity.METRE = new Quantity(60,'km');
var m3:Quantity.METRE = new Quantity('1/3','m');
var s1:Quantity.SECOND = new Quantity(60,'s');


@Test class QuantityTests {

	@Test static unitsAreInitializedCorrectly(){
		// right base units
		Assert.true(m1.hasBaseUnit('m'));
		Assert.true(s1.hasBaseUnit('s'));
	}

	@Test static valuesAreInitializedCorrectly(){
		// right values
		Assert.equals(m1.value, 60_000);
		Assert.equals(m3.value, 1/3);
	}

	@Test static async comparisonsWorkCorrectly(){
		// js equality (no strict equality)
		Assert.true(m1.equals(m2)); // 60km equals 60km
		Assert.false(m1.equals(s1)); // 60km does not equal 60s

		// DATEX value equality
		await Assert.sameValueAsync(m1,m2)  // 60km == 60km
	}

	@Test static additionWorksCorrectly(){
		var sum1 = m1.sum(m2);
		Assert.true(sum1.equals(new Quantity(120,'km'))); // 60km+60km equals 120km

		var sum2 = sum1.sum(new Quantity('2/3','nm'));
		Assert.true(sum2.equals(new Quantity('180000000000001/1500000000','m'))); // 120km + 2/3nm
	}

	@Test static subtractionWorksCorrectly(){
		var diff1 = m1.difference(m2);
		Assert.true(diff1.equals(new Quantity(0,'km'))); // 60km-60km equals 0km

		var diff2 = diff1.difference(new Quantity('2/3','nm'));
		Assert.true(diff2.equals(new Quantity('-2/3','nm'))); // 0m - 2/3nm = -2/3nm

	}

}