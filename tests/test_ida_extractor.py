import pytest
from mplads_fraud_detection.foundation.ida_extractor import (
    normalize_agency_name,
    clean_agency_name,
    derive_agency_from_district,
    validate_agency_name,
    extract_and_normalize_agency,
    extract_ida_from_csv
)


def test_normalize_parentheses_extraction():
    # Rule: MON(Deputy Commissioner Mon_IDA) -> Deputy Commissioner, Mon
    res = normalize_agency_name("MON(Deputy Commissioner Mon_IDA)")
    assert "Deputy Commissioner" in res
    assert "Mon" in res
    assert "_IDA" not in res


def test_normalize_strip_ida_suffix():
    assert normalize_agency_name("District Magistrate South 24 Parganas_IDA") == "District Magistrate, South 24 Parganas"
    assert normalize_agency_name("DEPUTY COMMISSIONER RANCHI_IDA") == "Deputy Commissioner, Ranchi"


def test_normalize_strip_numeric_suffix():
    res = normalize_agency_name("District Magistrate Patna_2")
    assert res == "District Magistrate, Patna"
    assert "_2" not in res


def test_normalize_fix_typos_magistrate():
    assert "Magistrate" in normalize_agency_name("Distirct Magistrae Jaunpur")


def test_normalize_fix_typos_commissioner():
    assert "Commissioner" in normalize_agency_name("Commisioner Varanasi")


def test_normalize_fix_typos_collector():
    assert "Collector" in normalize_agency_name("Colletor Kannur_IDA")


def test_normalize_preserve_acronyms():
    res = normalize_agency_name("Executive Engineer PWD Division")
    assert "PWD" in res
    res_cpwd = normalize_agency_name("Superintending Engineer CPWD")
    assert "CPWD" in res_cpwd
    res_drda = normalize_agency_name("Project Director DRDA")
    assert "DRDA" in res_drda


def test_derive_agency_from_district():
    derived = derive_agency_from_district("PATNA")
    assert derived == "District Magistrate, Patna"

    derived_state = derive_agency_from_district(None, state="BIHAR")
    assert derived_state == "State Nodal Authority, Bihar"

    default_agency = derive_agency_from_district(None, None)
    assert default_agency == "District Implementing Authority"


def test_validate_agency_name():
    assert validate_agency_name("District Magistrate, Patna") is True
    assert validate_agency_name("Deputy Commissioner, Mon") is True
    assert validate_agency_name("") is False
    assert validate_agency_name("nan") is False
    assert validate_agency_name("None") is False
    assert validate_agency_name(None) is False
    assert validate_agency_name("AB") is False


def test_extract_and_normalize_agency_with_work_description():
    desc = "Renovation of community hall with the CPWD serving as the implementing agency"
    clean, raw = extract_and_normalize_agency(work_description=desc)
    assert "CPWD" in clean

    desc2 = "Gram Panchayat Village Council will act as the implementing agency"
    clean2, raw2 = extract_and_normalize_agency(work_description=desc2)
    assert "Gram Panchayat" in clean2


def test_extract_and_normalize_agency_fallback_zero_nulls():
    clean, raw = extract_and_normalize_agency(raw_ida=None, work_description=None, district="LUCKNOW")
    assert clean is not None
    assert len(clean) > 0
    assert "Lucknow" in clean

    clean_def, raw_def = extract_and_normalize_agency(raw_ida=None, work_description=None, district=None)
    assert clean_def == "District Implementing Authority"


def test_backward_compatibility_clean_agency_name():
    assert clean_agency_name("District Magistrate Agra_IDA") == "District Magistrate, Agra"
