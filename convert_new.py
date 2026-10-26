import json
import os
import re
import sys
import warnings
import zipfile
import xml.etree.ElementTree as ET

warnings.filterwarnings("ignore")

excel_file = (
    sys.argv[1]
    if len(sys.argv) > 1
    else os.path.join(
        os.path.dirname(__file__),
        "public",
        "Course Schedule 2019-202 Semester(Pre-Registration).xlsx",
    )
)
output_file = (
    sys.argv[2]
    if len(sys.argv) > 2
    else os.path.join(
        os.path.dirname(__file__),
        "public",
        "courses.json",
    )
)

print(f"Reading Excel file: {excel_file}")
print("Parsing Excel XML directly...")

NS = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def get_shared_strings(zf):
    try:
        with zf.open("xl/sharedStrings.xml") as f:
            tree = ET.parse(f)
        root = tree.getroot()
        strings = []
        for si in root.findall(".//s:si", NS):
            text_parts = []
            for t in si.iter():
                if t.text:
                    text_parts.append(t.text)
            strings.append("".join(text_parts))
        return strings
    except KeyError:
        return []


def col_letter_to_index(col_str):
    result = 0
    for char in col_str:
        result = result * 26 + (ord(char.upper()) - ord("A") + 1)
    return result - 1


def parse_cell_ref(cell_ref):
    match = re.match(r"([A-Z]+)(\d+)", cell_ref)
    if match:
        col = col_letter_to_index(match.group(1))
        row = int(match.group(2))
        return row, col
    return None, None


def get_cell_value(cell, shared_strings):
    """Extract value from a cell element, handling all cell types."""
    cell_type = cell.get("t", "")

    # Check for inline string (is element)
    is_elem = cell.find("s:is", NS)
    if is_elem is not None:
        text_parts = []
        for t_elem in is_elem.iter():
            if t_elem.text:
                text_parts.append(t_elem.text)
        return "".join(text_parts) if text_parts else None

    # Check for value element
    v_elem = cell.find("s:v", NS)
    if v_elem is not None and v_elem.text is not None:
        if cell_type == "s":
            idx = int(v_elem.text)
            if idx < len(shared_strings):
                return shared_strings[idx]
            return None
        elif cell_type == "b":
            return bool(int(v_elem.text))
        else:
            return v_elem.text

    return None


def clean_time(text):
    """
    Clean time schedule strings by removing venue info in parentheses
    and standardizing whitespace.
    E.g. "M (EEM117) W (EEM117) F (EEM117)  17:00-18:00" -> "MWF 17:00-18:00"
    E.g. "MWF 09:00-10:00" -> "MWF 09:00-10:00"
    """
    if text is None or text == "nan":
        return "nan"

    text = str(text).strip()
    if not text:
        return "nan"

    # Remove all (venue) parenthetical info
    text = re.sub(r"\s*\([^)]*\)", "", text)

    # Split by comma to handle multiple time segments
    segments = text.split(",")
    cleaned_segments = []

    for segment in segments:
        segment = segment.strip()
        time_match = re.search(r"(\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})", segment)
        if time_match:
            time_part = time_match.group(1)
            time_part = re.sub(r"\s*-\s*", "-", time_part)
            day_part = segment[: time_match.start()].strip()

            # Merge single-letter days: "M  W  F" -> "MWF", keeping "Th" intact
            day_tokens = day_part.split()
            days = "".join(day_tokens)

            cleaned_segments.append(f"{days} {time_part}".strip())
        else:
            cleaned_segments.append(segment)

    result = " ,".join(cleaned_segments)
    return result if result.strip() else "nan"


def extract_course_details(text):
    """
    Extract course name and code. Handles cases like:
    - 'INCOMPRESSIBLE AERODYNAMICS(AE211)' -> ('INCOMPRESSIBLE AERODYNAMICS', 'AE211')
    - 'ENGINEERING GRAPHICS(TA111) /C' -> ('ENGINEERING GRAPHICS /C', 'TA111')
    - 'GEOGRAPHICAL INFORMATION SYSTEM (GIS)(CE432)' -> ('GEOGRAPHICAL INFORMATION SYSTEM (GIS)', 'CE432')
    """
    if text is None:
        return "", ""
    text = str(text).strip()
    matches = list(re.finditer(r"\(([^)]+)\)", text))
    if matches:
        m = matches[-1]
        course_code = m.group(1).strip()
        before = text[: m.start()].strip()
        after = text[m.end() :].strip()
        course_name = (before + (" " + after if after else "")).strip()
    else:
        course_name = text
        course_code = ""
    return course_name, course_code


def extract_slot_and_type(text):
    if text is None:
        return "", ""
    parts = str(text).split("/")
    slot = parts[0].strip() if len(parts) > 0 else ""
    course_type = parts[1].strip() if len(parts) > 1 else ""
    return slot, course_type


def extract_credits(text):
    if text is None:
        return 0
    match = re.search(r"\((\d+)\)", str(text))
    if match:
        return int(match.group(1))
    return 0


def clean(value):
    if value is None:
        return "nan"
    value = str(value).strip()
    return value if value else "nan"


try:
    with zipfile.ZipFile(excel_file, "r") as zf:
        shared_strings = get_shared_strings(zf)
        print(f"Shared strings count: {len(shared_strings)}")

        with zf.open("xl/worksheets/sheet1.xml") as f:
            tree = ET.parse(f)
        root = tree.getroot()

        # Parse all rows
        all_rows = {}
        max_col = 0

        for row_elem in root.findall(".//s:row", NS):
            row_num = int(row_elem.get("r"))
            row_data = {}

            for cell in row_elem.findall("s:c", NS):
                cell_ref = cell.get("r")
                _, col_idx = parse_cell_ref(cell_ref)
                value = get_cell_value(cell, shared_strings)

                if col_idx is not None:
                    max_col = max(max_col, col_idx)
                    row_data[col_idx] = value

            all_rows[row_num] = row_data

    sorted_rows = sorted(all_rows.keys())
    print(f"Total rows: {len(sorted_rows)}, Max col: {max_col}")

    # Find header row
    header_row_num = None
    headers = {}
    for rn in sorted_rows:
        row = all_rows[rn]
        non_null_count = sum(
            1 for v in row.values() if v is not None and str(v).strip()
        )
        if non_null_count >= 3:
            row_text = " ".join(str(v) for v in row.values() if v is not None)
            if (
                "Br" in row_text
                or "Course" in row_text
                or "Slot" in row_text
                or "Instructor" in row_text
            ):
                header_row_num = rn
                for ci, val in row.items():
                    if val is not None:
                        headers[ci] = str(val).strip()
                break

    if header_row_num is None:
        header_row_num = sorted_rows[0]
        for ci, val in all_rows[header_row_num].items():
            if val is not None:
                headers[ci] = str(val).strip()

    print(f"\nHeader row: {header_row_num}")
    print("Headers:")
    for ci in sorted(headers.keys()):
        print(f"  [{ci}] '{headers[ci]}'")

    # Find Time columns: Lecture (1st), Tutorial (2nd), Practical (3rd)
    time_col_indices = [
        ci for ci in sorted(headers.keys()) if headers[ci] == "Time"
    ]
    print(f"\nTime columns at indices: {time_col_indices}")
    lec_col = time_col_indices[0] if len(time_col_indices) > 0 else None
    tut_col = time_col_indices[1] if len(time_col_indices) > 1 else None
    prac_col = time_col_indices[2] if len(time_col_indices) > 2 else None

    # Helper to fetch by header name
    def get_by_header(row, header_name):
        for ci, hdr in headers.items():
            if hdr == header_name:
                return row.get(ci)
        return None

    # =========================================================
    # BUILD JSON
    # =========================================================
    json_data = []

    for rn in sorted_rows:
        if rn <= header_row_num:
            continue

        row = all_rows[rn]

        # Skip empty rows
        non_null = [
            v for v in row.values() if v is not None and str(v).strip()
        ]
        if len(non_null) < 2:
            continue

        course_name, course_code = extract_course_details(
            get_by_header(row, "Course Name/Group Name")
        )

        # Skip rows without course code
        if not course_code:
            continue

        slot, course_type = extract_slot_and_type(
            get_by_header(row, "Slot Name/Course Type")
        )

        credits = extract_credits(get_by_header(row, "Credits"))

        instructor_email = get_by_header(row, "Instuctor Email")
        if instructor_email is None:
            instructor_email = get_by_header(row, "Instructor Email")

        lec_sched = (
            clean_time(row.get(lec_col)) if lec_col is not None else "nan"
        )
        tut_sched = (
            clean_time(row.get(tut_col)) if tut_col is not None else "nan"
        )
        prac_sched = (
            clean_time(row.get(prac_col)) if prac_col is not None else "nan"
        )

        obj = {
            "branch": clean(get_by_header(row, "Br")),
            "course_name": course_name,
            "course_code": course_code,
            "slot": slot,
            "credits": credits,
            "course_type": course_type,
            "instructor": clean(get_by_header(row, "Instructor")),
            "instructor_email": clean(instructor_email),
            "lecture_schedule": lec_sched,
            "tutorial_schedule": tut_sched,
            "practical_schedule": prac_sched,
        }

        json_data.append(obj)

    # =========================================================
    # SAVE JSON
    # =========================================================
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(json_data, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"\nSUCCESS!")
    print(f"JSON file created: {output_file}")
    print(f"Total courses: {len(json_data)}")

except Exception as e:
    import traceback

    traceback.print_exc()
