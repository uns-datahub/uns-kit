from __future__ import annotations

from .types import CompiledSqlStatement, DatabaseDialect, SqlParams

ORACLE_IN_LIST_LIMIT = 1000


def _is_identifier_start(char: str | None) -> bool:
    return bool(char) and (char.isalpha() or char == "_")


def _is_identifier_part(char: str | None) -> bool:
    return bool(char) and (char.isalnum() or char == "_")


def _read_parameter_name(sql_text: str, start_index: int) -> tuple[str, int]:
    index = start_index
    name = []
    while index < len(sql_text) and _is_identifier_part(sql_text[index]):
        name.append(sql_text[index])
        index += 1
    return "".join(name), index - 1


def compile_named_params(
    dialect: DatabaseDialect,
    sql_text: str,
    params: SqlParams | None = None,
) -> CompiledSqlStatement:
    resolved_params = params or {}
    output: list[str] = []
    values: list[object] = []
    bind_values: dict[str, object] = {}
    parameter_order: list[str] = []
    in_single_quote = False
    in_double_quote = False
    in_line_comment = False
    in_block_comment = False

    index = 0
    while index < len(sql_text):
        char = sql_text[index]
        next_char = sql_text[index + 1] if index + 1 < len(sql_text) else None
        previous_char = sql_text[index - 1] if index > 0 else None

        if in_line_comment:
            output.append(char)
            if char == "\n":
                in_line_comment = False
            index += 1
            continue

        if in_block_comment:
            output.append(char)
            if char == "*" and next_char == "/":
                output.append("/")
                in_block_comment = False
                index += 2
                continue
            index += 1
            continue

        if not in_double_quote and char == "'" and previous_char != "\\":
            in_single_quote = not in_single_quote
            output.append(char)
            index += 1
            continue

        if not in_single_quote and char == '"' and previous_char != "\\":
            in_double_quote = not in_double_quote
            output.append(char)
            index += 1
            continue

        if in_single_quote or in_double_quote:
            output.append(char)
            index += 1
            continue

        if char == "-" and next_char == "-":
            output.extend(["-", "-"])
            in_line_comment = True
            index += 2
            continue

        if char == "/" and next_char == "*":
            output.extend(["/", "*"])
            in_block_comment = True
            index += 2
            continue

        if char == ":" and previous_char != ":" and _is_identifier_start(next_char):
            name, end_index = _read_parameter_name(sql_text, index + 1)
            if name not in resolved_params:
                raise ValueError(f"Missing SQL parameter ':{name}'.")
            value = resolved_params[name]
            if isinstance(value, list):
                in_list_context = _get_in_list_context("".join(output), sql_text, end_index + 1) if dialect == "oracle" else None
                if len(value) == 0:
                    if in_list_context is not None:
                        del output[in_list_context["start_index"] :]
                        output.append("1 = 0")
                        index = in_list_context["closing_paren_index"] + 1
                        continue
                    output.append("(select 1 where 1 = 0)")
                    index = end_index + 1
                    continue

                placeholders = _build_array_placeholders(
                    dialect,
                    name,
                    value,
                    values,
                    bind_values,
                    parameter_order,
                    in_list_context["left_side_expression"] if in_list_context else None,
                )
                if in_list_context is not None:
                    del output[in_list_context["start_index"] :]
                output.append(placeholders)
                index = (in_list_context["closing_paren_index"] + 1) if in_list_context else (end_index + 1)
                continue

            if dialect == "oracle":
                parameter_order.append(name)
                bind_values[name] = value
                output.append(f":{name}")
            elif dialect == "pg":
                values.append(value)
                parameter_order.append(name)
                output.append("%s")
            else:
                parameter_order.append(name)
                values.append(value)
                output.append("?")
            index = end_index + 1
            continue

        output.append(char)
        index += 1

    return CompiledSqlStatement(
        text="".join(output),
        values=bind_values if dialect == "oracle" else values,
        parameter_order=parameter_order,
    )


def _build_array_placeholders(
    dialect: DatabaseDialect,
    name: str,
    array_value: list[object],
    values: list[object],
    bind_values: dict[str, object],
    parameter_order: list[str],
    left_side_expression: str | None = None,
) -> str:
    if dialect == "oracle":
        chunks = [array_value[index : index + ORACLE_IN_LIST_LIMIT] for index in range(0, len(array_value), ORACLE_IN_LIST_LIMIT)]
        chunk_sql: list[str] = []
        for chunk_index, chunk in enumerate(chunks):
            placeholders = []
            for item_index, item in enumerate(chunk):
                bind_name = f"{name}_{chunk_index}_{item_index}"
                bind_values[bind_name] = item
                parameter_order.append(bind_name)
                placeholders.append(f":{bind_name}")
            if left_side_expression:
                chunk_sql.append(f"{left_side_expression.strip()} IN ({', '.join(placeholders)})")
            else:
                chunk_sql.append(", ".join(placeholders))
        return f"({' OR '.join(chunk_sql)})" if left_side_expression else ", ".join(chunk_sql)

    if dialect == "pg":
        placeholders = []
        for item in array_value:
            values.append(item)
            parameter_order.append(name)
            placeholders.append("%s")
        return ", ".join(placeholders)

    placeholders = []
    for item in array_value:
        values.append(item)
        parameter_order.append(name)
        placeholders.append("?")
    return ", ".join(placeholders)


def _get_in_list_context(output_text: str, sql_text: str, search_start_index: int) -> dict[str, int | str] | None:
    import re

    match = re.search(r'([A-Za-z0-9_."$]+)\s+IN\s*\($', output_text, re.IGNORECASE)
    if match is None:
        return None

    cursor = search_start_index
    while cursor < len(sql_text) and sql_text[cursor].isspace():
        cursor += 1
    if cursor >= len(sql_text) or sql_text[cursor] != ")":
        return None

    return {
        "start_index": match.start(),
        "left_side_expression": match.group(1),
        "closing_paren_index": cursor,
    }
