function escapeJsonPointerSegment(value) {
  return String(value)
    .replace(/~/g, '~0')
    .replace(/\//g, '~1');
}

function unescapeJsonPointerSegment(value) {
  return String(value)
    .replace(/~1/g, '/')
    .replace(/~0/g, '~');
}

function pathToSegments(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (value === undefined || value === null || value === '') {
    return [];
  }

  const raw = String(value);

  // Already a JSON Pointer.
  if (raw.startsWith('/')) {
    return raw
      .split('/')
      .slice(1)
      .map(unescapeJsonPointerSegment);
  }

  // Support AJV/Fastify dot/bracket paths.
  return raw
    .replace(/^\./, '')
    .replace(/\[['"]?([^'"\]]+)['"]?\]/g, '.$1')
    .split('.')
    .filter(Boolean);
}

function toJsonPointer(value) {
  const segments = pathToSegments(value);

  if (!segments.length) {
    return null;
  }

  return `/${segments.map(escapeJsonPointerSegment).join('/')}`;
}

function normalizeValidationDetail(detail = {}) {
  const basePath =
    detail.path ?? detail.instancePath ?? detail.dataPath ?? null;

  let pointer = toJsonPointer(basePath);

  // AJV required-property errors point to the parent object.
  if (detail.keyword === 'required' && detail.params?.missingProperty) {
    const missingProperty = escapeJsonPointerSegment(
      detail.params.missingProperty
    );

    pointer = `${pointer || ''}/${missingProperty}`;
  }

  // AJV additionalProperties errors point to the parent object.
  if (
    detail.keyword === 'additionalProperties' &&
    detail.params?.additionalProperty
  ) {
    const additionalProperty = escapeJsonPointerSegment(
      detail.params.additionalProperty
    );

    pointer = `${pointer || ''}/${additionalProperty}`;
  }

  return {
    path: pointer,
    message: detail.message || 'is invalid',
    keyword: detail.keyword || detail.code || null,
  };
}

function normalizeValidationDetails(details = []) {
  return details.map(normalizeValidationDetail);
}

module.exports = {
  escapeJsonPointerSegment,
  pathToSegments,
  toJsonPointer,
  normalizeValidationDetail,
  normalizeValidationDetails,
};