"""Validation boundary for untrusted SVG certificate templates.

The validator is deliberately independent from Flask and from the SVG
transformation helpers.  Callers can therefore validate bytes immediately
after upload, before parsing, rewriting, storing, or rendering them.
"""

from __future__ import annotations

import base64
import binascii
import os
import re
from dataclasses import dataclass
from xml.etree.ElementTree import ParseError

import tinycss2
from defusedxml import ElementTree as SafeElementTree
from defusedxml.common import DefusedXmlException


SVG_NAMESPACE = "http://www.w3.org/2000/svg"
XLINK_NAMESPACE = "http://www.w3.org/1999/xlink"
XML_NAMESPACE = "http://www.w3.org/XML/1998/namespace"

PUBLIC_ERROR = "SVG inválido o no permitido"


def _positive_env(name: str, default: int) -> int:
    try:
        value = int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default
    return value if value > 0 else default


@dataclass(frozen=True)
class SvgLimits:
    max_bytes: int = 5 * 1024 * 1024
    max_elements: int = 10_000
    max_depth: int = 100
    max_attributes_per_element: int = 128
    max_total_attributes: int = 50_000

    @classmethod
    def from_env(cls) -> "SvgLimits":
        return cls(
            max_bytes=_positive_env("MAX_SVG_BYTES", cls.max_bytes),
            max_elements=_positive_env("MAX_SVG_ELEMENTS", cls.max_elements),
            max_depth=_positive_env("MAX_SVG_DEPTH", cls.max_depth),
            max_attributes_per_element=_positive_env(
                "MAX_SVG_ATTRIBUTES_PER_ELEMENT", cls.max_attributes_per_element
            ),
            max_total_attributes=_positive_env(
                "MAX_SVG_TOTAL_ATTRIBUTES", cls.max_total_attributes
            ),
        )


class SvgValidationError(ValueError):
    """Internal validation failure with a stable public representation."""

    public_message = PUBLIC_ERROR

    def __init__(self, code: str):
        self.code = code
        super().__init__(PUBLIC_ERROR)


_ALLOWED_TAGS = {
    "svg",
    "g",
    "defs",
    "title",
    "desc",
    "metadata",
    "a",
    "path",
    "rect",
    "circle",
    "ellipse",
    "line",
    "polyline",
    "polygon",
    "text",
    "tspan",
    "textpath",
    "lineargradient",
    "radialgradient",
    "stop",
    "pattern",
    "clippath",
    "mask",
    "marker",
    "symbol",
    "switch",
    "view",
    "use",
    "image",
    "style",
    "filter",
    "feblend",
    "fecolormatrix",
    "fecomponenttransfer",
    "fecomposite",
    "feconvolvematrix",
    "fediffuselighting",
    "fedisplacementmap",
    "fedistantlight",
    "fedropshadow",
    "feflood",
    "fefunca",
    "fefuncb",
    "fefuncg",
    "fefuncr",
    "fegaussianblur",
    "feimage",
    "femerge",
    "femergenode",
    "femorphology",
    "feoffset",
    "fepointlight",
    "fespecularlighting",
    "fespotlight",
    "fetile",
    "feturbulence",
}

# SVG presentation, geometry, text, gradient, pattern, and filter attributes.
# Names are normalized to lowercase before comparison.
_ALLOWED_ATTRIBUTES = {
    "accent-height",
    "accumulate",
    "additive",
    "alignment-baseline",
    "amplitude",
    "ascent",
    "azimuth",
    "basefrequency",
    "baseline-shift",
    "bias",
    "by",
    "class",
    "clip",
    "clip-path",
    "clip-rule",
    "clippathunits",
    "color",
    "color-interpolation",
    "color-interpolation-filters",
    "color-rendering",
    "cx",
    "cy",
    "d",
    "diffuseconstant",
    "direction",
    "display",
    "divisor",
    "dominant-baseline",
    "dx",
    "dy",
    "edgemode",
    "elevation",
    "end",
    "exponent",
    "fill",
    "fill-opacity",
    "fill-rule",
    "filter",
    "filterunits",
    "flood-color",
    "flood-opacity",
    "font-family",
    "font-size",
    "font-size-adjust",
    "font-stretch",
    "font-style",
    "font-variant",
    "font-weight",
    "fx",
    "fy",
    "gradienttransform",
    "gradientunits",
    "height",
    "href",
    "id",
    "image-rendering",
    "in",
    "in2",
    "intercept",
    "k",
    "k1",
    "k2",
    "k3",
    "k4",
    "kernelmatrix",
    "kernelunitlength",
    "kerning",
    "lang",
    "lengthadjust",
    "letter-spacing",
    "lighting-color",
    "marker-end",
    "marker-mid",
    "marker-start",
    "markerheight",
    "markerunits",
    "markerwidth",
    "mask",
    "mask-type",
    "maskcontentunits",
    "maskunits",
    "mode",
    "name",
    "numoctaves",
    "offset",
    "opacity",
    "operator",
    "order",
    "orient",
    "origin",
    "overflow",
    "paint-order",
    "pathlength",
    "patterncontentunits",
    "patterntransform",
    "patternunits",
    "pointer-events",
    "points",
    "preservealpha",
    "preserveaspectratio",
    "primitiveunits",
    "r",
    "radius",
    "refx",
    "refy",
    "result",
    "rotate",
    "rx",
    "ry",
    "scale",
    "seed",
    "shape-rendering",
    "slope",
    "space",
    "specularconstant",
    "specularexponent",
    "spreadmethod",
    "startoffset",
    "stddeviation",
    "stitchtiles",
    "stop-color",
    "stop-opacity",
    "stroke",
    "stroke-dasharray",
    "stroke-dashoffset",
    "stroke-linecap",
    "stroke-linejoin",
    "stroke-miterlimit",
    "stroke-opacity",
    "stroke-width",
    "style",
    "surfacescale",
    "systemlanguage",
    "tablevalues",
    "targetx",
    "targety",
    "text-anchor",
    "text-decoration",
    "text-rendering",
    "textlength",
    "transform",
    "transform-origin",
    "type",
    "values",
    "vector-effect",
    "version",
    "viewbox",
    "visibility",
    "width",
    "word-spacing",
    "writing-mode",
    "x",
    "x1",
    "x2",
    "xchannelselector",
    "y",
    "y1",
    "y2",
    "ychannelselector",
    "zoomandpan",
}

_ALLOWED_ATTRIBUTE_NAMESPACES = {"", XLINK_NAMESPACE, XML_NAMESPACE}
_FRAGMENT_REFERENCE = re.compile(r"^#[^\s<>\"']+$")
_DATA_RESOURCE = re.compile(
    r"^data:(?P<mime>image/(?:png|jpeg|gif|webp)|"
    r"font/(?:ttf|otf|woff|woff2|truetype|opentype));base64,(?P<data>[A-Za-z0-9+/]+={0,2})$",
    re.IGNORECASE,
)
_PROCESSING_STYLESHEET = re.compile(r"<\?xml-stylesheet\b", re.IGNORECASE)
_URI_ATTRIBUTES = {"href"}
_FORBIDDEN_CSS_FUNCTIONS = {"expression", "behavior", "-moz-binding"}
_ABSOLUTE_CSS_RESOURCE = re.compile(r"(?:[a-z][a-z0-9+.-]*\s*:|//)", re.IGNORECASE)


def _split_expanded_name(name: str) -> tuple[str, str]:
    if name.startswith("{") and "}" in name:
        namespace, local = name[1:].split("}", 1)
        return namespace, local
    return "", name


def _decode_svg(svg: str | bytes, limits: SvgLimits) -> str:
    if isinstance(svg, bytes):
        raw = svg
        try:
            text = raw.decode("utf-8-sig")
        except UnicodeDecodeError as exc:
            raise SvgValidationError("encoding") from exc
    elif isinstance(svg, str):
        text = svg.lstrip("\ufeff")
        raw = text.encode("utf-8")
    else:
        raise SvgValidationError("type")

    if not text.strip():
        raise SvgValidationError("empty")
    if len(raw) > limits.max_bytes:
        raise SvgValidationError("bytes")
    if _PROCESSING_STYLESHEET.search(text):
        raise SvgValidationError("processing-instruction")
    return text


def _safe_data_resource(value: str, *, allow_font: bool) -> bool:
    match = _DATA_RESOURCE.fullmatch(value)
    if not match:
        return False
    if match.group("mime").lower().startswith("font/") and not allow_font:
        return False
    try:
        base64.b64decode(match.group("data"), validate=True)
    except (binascii.Error, ValueError):
        return False
    return True


def _is_safe_reference(value: str, *, css: bool = False) -> bool:
    normalized = value.strip()
    if not normalized:
        return True
    if _FRAGMENT_REFERENCE.fullmatch(normalized):
        return True
    return _safe_data_resource(normalized, allow_font=css)


def _function_url(token) -> str | None:
    arguments = [
        part for part in token.arguments if part.type not in {"whitespace", "comment"}
    ]
    if len(arguments) == 1 and arguments[0].type == "string":
        return arguments[0].value
    serialized = tinycss2.serialize(token.arguments).strip()
    return serialized or None


def _validate_css_tokens(tokens) -> None:
    for token in tokens or ():
        token_type = getattr(token, "type", "")
        if token_type == "error":
            raise SvgValidationError("css-syntax")
        if token_type == "url":
            if not _is_safe_reference(token.value, css=True):
                raise SvgValidationError("css-url")
        elif token_type == "function":
            function_name = token.lower_name
            if function_name in _FORBIDDEN_CSS_FUNCTIONS:
                raise SvgValidationError("css-function")
            if function_name == "url":
                url = _function_url(token)
                if url is None or not _is_safe_reference(url, css=True):
                    raise SvgValidationError("css-url")
            else:
                _validate_css_tokens(token.arguments)
        elif token_type == "string":
            if _ABSOLUTE_CSS_RESOURCE.search(token.value):
                raise SvgValidationError("css-resource")
        elif token_type == "at-rule":
            if token.lower_at_keyword != "font-face":
                raise SvgValidationError("css-at-rule")
            _validate_css_tokens(token.prelude)
            declarations = tinycss2.parse_blocks_contents(
                token.content or (), skip_comments=True, skip_whitespace=True
            )
            _validate_css_tokens(declarations)
        elif token_type == "qualified-rule":
            _validate_css_tokens(token.prelude)
            declarations = tinycss2.parse_blocks_contents(
                token.content or (), skip_comments=True, skip_whitespace=True
            )
            _validate_css_tokens(declarations)
        elif token_type == "declaration":
            if token.lower_name in _FORBIDDEN_CSS_FUNCTIONS:
                raise SvgValidationError("css-property")
            _validate_css_tokens(token.value)
        else:
            nested = getattr(token, "content", None)
            if nested is not None:
                _validate_css_tokens(nested)


def _validate_css(css: str, *, stylesheet: bool) -> None:
    # Comments and CSS escapes can splice or conceal identifiers such as
    # `u/**/rl` and escaped `@import`. Certificate templates do not need them,
    # so reject ambiguous CSS instead of attempting normalization.
    if "/*" in css or "\\" in css:
        raise SvgValidationError("css-obfuscation")
    if stylesheet:
        tokens = tinycss2.parse_stylesheet(
            css, skip_comments=True, skip_whitespace=True
        )
    else:
        tokens = tinycss2.parse_blocks_contents(
            css, skip_comments=True, skip_whitespace=True
        )
    _validate_css_tokens(tokens)


def _validate_attribute(name: str, value: str) -> None:
    namespace, local = _split_expanded_name(name)
    normalized = local.lower()

    if namespace not in _ALLOWED_ATTRIBUTE_NAMESPACES:
        raise SvgValidationError("attribute-namespace")
    if normalized.startswith("on"):
        raise SvgValidationError("event-handler")
    if normalized not in _ALLOWED_ATTRIBUTES:
        raise SvgValidationError("attribute")
    if normalized in _URI_ATTRIBUTES and not _is_safe_reference(value):
        raise SvgValidationError("resource-url")
    if normalized == "style":
        _validate_css(value, stylesheet=False)
    elif "url" in value.lower():
        _validate_css_tokens(tinycss2.parse_component_value_list(value))


def validate_svg(svg: str | bytes, *, limits: SvgLimits | None = None) -> str:
    """Validate an SVG and return its original UTF-8 text if it is safe.

    The function never fetches resources and never rewrites the document.
    Invalid content raises :class:`SvgValidationError`.
    """

    effective_limits = limits or SvgLimits.from_env()
    text = _decode_svg(svg, effective_limits)

    try:
        root = SafeElementTree.fromstring(
            text,
            forbid_dtd=True,
            forbid_entities=True,
            forbid_external=True,
        )
    except (DefusedXmlException, ParseError, ValueError) as exc:
        raise SvgValidationError("xml") from exc

    root_namespace, root_name = _split_expanded_name(root.tag)
    if root_name.lower() != "svg" or root_namespace not in {"", SVG_NAMESPACE}:
        raise SvgValidationError("root")

    element_count = 0
    total_attributes = 0
    stack = [(root, 1)]
    while stack:
        element, depth = stack.pop()
        element_count += 1
        if element_count > effective_limits.max_elements:
            raise SvgValidationError("elements")
        if depth > effective_limits.max_depth:
            raise SvgValidationError("depth")

        namespace, tag = _split_expanded_name(element.tag)
        if namespace not in {"", SVG_NAMESPACE} or tag.lower() not in _ALLOWED_TAGS:
            raise SvgValidationError("element")

        attribute_count = len(element.attrib)
        if attribute_count > effective_limits.max_attributes_per_element:
            raise SvgValidationError("attributes-per-element")
        total_attributes += attribute_count
        if total_attributes > effective_limits.max_total_attributes:
            raise SvgValidationError("attributes-total")

        for attribute_name, value in element.attrib.items():
            _validate_attribute(attribute_name, value)

        if tag.lower() == "style":
            _validate_css("".join(element.itertext()), stylesheet=True)

        stack.extend((child, depth + 1) for child in reversed(list(element)))

    return text


__all__ = [
    "PUBLIC_ERROR",
    "SvgLimits",
    "SvgValidationError",
    "validate_svg",
]
