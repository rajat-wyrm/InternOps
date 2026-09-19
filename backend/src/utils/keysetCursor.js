function encodeCursor(value) {
  if (!value || typeof value !== 'object') {
    throw new TypeError('Cursor value must be an object');
  }

  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function decodeCursor(cursor) {
  if (typeof cursor !== 'string' || !cursor.trim()) {
    return null;
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8')
    );

    if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) {
      throw new Error('Invalid cursor payload');
    }

    return decoded;
  } catch {
    const error = new Error('Invalid cursor');
    error.statusCode = 400;
    throw error;
  }
}

module.exports = {
  encodeCursor,
  decodeCursor,
};
