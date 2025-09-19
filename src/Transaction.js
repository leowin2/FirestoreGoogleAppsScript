'use strict';

function _classCallCheck(a, n) {
  if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function");
}
function _defineProperties(e, r) {
  for (var t = 0; t < r.length; t++) {
    var o = r[t];
    o.enumerable = o.enumerable || false, o.configurable = true, "value" in o && (o.writable = true), Object.defineProperty(e, _toPropertyKey(o.key), o);
  }
}
function _createClass(e, r, t) {
  return r && _defineProperties(e.prototype, r), Object.defineProperty(e, "prototype", {
    writable: false
  }), e;
}
function _defineProperty(e, r, t) {
  return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, {
    value: t,
    enumerable: true,
    configurable: true,
    writable: true
  }) : e[r] = t, e;
}
function ownKeys(e, r) {
  var t = Object.keys(e);
  if (Object.getOwnPropertySymbols) {
    var o = Object.getOwnPropertySymbols(e);
    r && (o = o.filter(function (r) {
      return Object.getOwnPropertyDescriptor(e, r).enumerable;
    })), t.push.apply(t, o);
  }
  return t;
}
function _objectSpread2(e) {
  for (var r = 1; r < arguments.length; r++) {
    var t = null != arguments[r] ? arguments[r] : {};
    r % 2 ? ownKeys(Object(t), true).forEach(function (r) {
      _defineProperty(e, r, t[r]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) {
      Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r));
    });
  }
  return e;
}
function _toPrimitive(t, r) {
  if ("object" != typeof t || !t) return t;
  var e = t[Symbol.toPrimitive];
  if (void 0 !== e) {
    var i = e.call(t, r);
    if ("object" != typeof i) return i;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return ("string" === r ? String : Number)(t);
}
function _toPropertyKey(t) {
  var i = _toPrimitive(t, "string");
  return "symbol" == typeof i ? i : i + "";
}

/**
 * A transaction is a set of read and write operations on one or more documents.
 */
var Transaction = /*#__PURE__*/function () {
  /**
   * @param baseUrl The Firestore base URL
   * @param basePath The Firestore base path
   * @param authToken The authentication token
   */
  function Transaction(baseUrl, basePath, authToken) {
    _classCallCheck(this, Transaction);
    _defineProperty(this, "transactionId", void 0);
    _defineProperty(this, "writes", []);
    _defineProperty(this, "baseUrl", void 0);
    _defineProperty(this, "basePath", void 0);
    _defineProperty(this, "authToken", void 0);
    _defineProperty(this, "isActive", false);
    this.baseUrl = baseUrl;
    this.basePath = basePath;
    this.authToken = authToken;
  }

  /**
   * Begin a new transaction.
   *
   * @param options transaction options (readOnly vs readWrite)
   * @return this Transaction instance for chaining
   */
  return _createClass(Transaction, [{
    key: "begin",
    value: function begin(options) {
      if (this.isActive) {
        throw new Error('Transaction is already active');
      }
      var request = new Request(this.baseUrl.replace('/documents/', '/documents:beginTransaction/'), this.authToken);
      var payload = {
        options: options || {
          readWrite: {}
        }
      };
      var response = request.post('', payload);
      this.transactionId = response.transaction;
      this.transactionId = this.transactionId.replaceAll(" ", "");
      this.isActive = true;
      return this;
    }

    /**
     * Get a document within the transaction.
     *
     * @param path the path to the document
     * @return the document object
     */
  }, {
    key: "get",
    value: function get(path) {
      if (!this.isActive) {
        throw new Error('Transaction is not active');
      }
      var request = new Request(this.baseUrl, this.authToken);
      request.addParam('transaction', this.transactionId);
      var doc = request.get(path);
      if (!doc.fields) {
        throw new Error('No document with `fields` found at path ' + path);
      }
      return new Document(doc, {});
    }

    /**
     * Get multiple documents within the transaction.
     *
     * @param paths array of document paths
     * @return array of documents
     */
  }, {
    key: "getAll",
    value: function getAll(paths) {
      var _this = this;
      if (!this.isActive) {
        throw new Error('Transaction is not active');
      }
      var request = new Request(this.baseUrl.replace('/documents/', '/documents:batchGet/'), this.authToken);
      var absolutePaths = paths.map(function (path) {
        return _this.basePath + path;
      });
      var payload = {
        documents: absolutePaths,
        transaction: this.transactionId
      };
      var documents = request.post('', payload);
      documents = documents.filter(function (docItem) {
        return docItem.found;
      });
      return documents.map(function (docItem) {
        var doc = new Document(docItem.found, {
          readTime: docItem.readTime
        });
        doc.readTime = docItem.readTime;
        return doc;
      });
    }

    /**
     * Create a document within the transaction.
     *
     * @param path the path where the document will be written
     * @param fields the document's fields
     * @return this Transaction instance for chaining
     */
  }, {
    key: "create",
    value: function create(path, fields) {
      if (!this.isActive) {
        throw new Error('Transaction is not active');
      }
      var pathDoc = Util_.getDocumentFromPath(path);
      var documentId = pathDoc[1];
      if (!documentId) {
        throw new Error('Document ID is required for transaction create operations');
      }
      var fullPath = this.getFullDocumentPath(path);
      var firestoreDocument = new Document(fields);
      this.writes.push({
        update: {
          name: fullPath,
          fields: firestoreDocument.fields
        },
        currentDocument: {
          exists: false
        }
      });
      return this;
    }

    /**
     * Set a document within the transaction.
     *
     * @param path the path where the document will be written
     * @param fields the document's fields
     * @param merge whether to merge with existing document
     * @return this Transaction instance for chaining
     */
  }, {
    key: "set",
    value: function set(path, fields, merge) {
      if (!this.isActive) {
        throw new Error('Transaction is not active');
      }
      var fullPath = this.getFullDocumentPath(path);
      var firestoreDocument = new Document(fields);
      var write = {
        update: {
          name: fullPath,
          fields: firestoreDocument.fields
        }
      };
      if (merge) {
        write.updateMask = {
          fieldPaths: Object.keys(fields).map(function (field) {
            return "`".concat(field.replace(/`/g, '\\`'), "`");
          })
        };
      }
      this.writes.push(write);
      return this;
    }

    /**
     * Update a document within the transaction.
     *
     * @param path the path of the document to update
     * @param fields the document's new fields
     * @param mask if true, the update will mask the given fields
     * @return this Transaction instance for chaining
     */
  }, {
    key: "update",
    value: function update(path, fields, mask) {
      if (!this.isActive) {
        throw new Error('Transaction is not active');
      }
      var fullPath = this.getFullDocumentPath(path);
      var firestoreDocument = new Document(fields);
      var write = {
        update: {
          name: fullPath,
          fields: firestoreDocument.fields
        },
        currentDocument: {
          exists: true
        }
      };
      if (mask) {
        var maskData = typeof mask === 'boolean' ? Object.keys(fields) : mask;
        if (!Array.isArray(maskData)) {
          throw new Error('Mask must be a boolean or an array of strings!');
        }
        if (!maskData.length) {
          throw new Error('Missing fields in Mask!');
        }
        write.updateMask = {
          fieldPaths: maskData.map(function (field) {
            return "`".concat(field.replace(/`/g, '\\`'), "`");
          })
        };
      }
      this.writes.push(write);
      return this;
    }

    /**
     * Delete a document within the transaction.
     *
     * @param path the path to the document to delete
     * @return this Transaction instance for chaining
     */
  }, {
    key: "delete",
    value: function _delete(path) {
      if (!this.isActive) {
        throw new Error('Transaction is not active');
      }
      var fullPath = this.getFullDocumentPath(path);
      this.writes.push({
        delete: fullPath
      });
      return this;
    }

    /**
     * Apply a transformation to a document's field within the transaction.
     *
     * @param path the path to the document to transform
     * @param field the field to transform
     * @param transformation the transformation to apply
     * @return this Transaction instance for chaining
     */
  }, {
    key: "transform",
    value: function transform(path, field, transformation) {
      if (!this.isActive) {
        throw new Error('Transaction is not active');
      }
      var fullPath = this.getFullDocumentPath(path);
      this.writes.push({
        transform: {
          document: fullPath,
          fieldTransforms: [_objectSpread2({
            fieldPath: field
          }, transformation)]
        }
      });
      return this;
    }

    /**
     * Commit the transaction.
     *
     * @return array of write results
     */
  }, {
    key: "commit",
    value: function commit() {
      if (!this.isActive) {
        throw new Error('Transaction is not active');
      }
      var request = new Request(this.baseUrl.replace('/documents/', '/documents:commit/'), this.authToken);
      var payload = {
        writes: this.writes,
        transaction: this.transactionId
      };
      var response = request.post('', payload);

      // Reset transaction state
      this.isActive = false;
      this.writes = [];
      this.transactionId = undefined;
      return response.writeResults || [];
    }

    /**
     * Rollback the transaction.
     *
     * @return empty response
     */
  }, {
    key: "rollback",
    value: function rollback() {
      if (!this.isActive) {
        throw new Error('Transaction is not active');
      }
      var request = new Request(this.baseUrl.replace('/documents/', '/documents:rollback/'), this.authToken);
      var payload = {
        transaction: this.transactionId
      };
      var response = request.post('', payload);

      // Reset transaction state
      this.isActive = false;
      this.writes = [];
      this.transactionId = undefined;
      return response;
    }

    /**
     * Get the current transaction ID.
     *
     * @return the transaction ID
     */
  }, {
    key: "getTransactionId",
    value: function getTransactionId() {
      return this.transactionId;
    }

    /**
     * Check if the transaction is active.
     *
     * @return true if the transaction is active
     */
  }, {
    key: "isTransactionActive",
    value: function isTransactionActive() {
      return this.isActive;
    }

    /**
     * Convert a document path to a full Firestore document name.
     */
  }, {
    key: "getFullDocumentPath",
    value: function getFullDocumentPath(path) {
      var cleanPath = Util_.cleanPath(path);
      return this.baseUrl.replace('/documents/', '/documents/').replace(/\/$/, '') + '/' + cleanPath;
    }
  }]);
}();
