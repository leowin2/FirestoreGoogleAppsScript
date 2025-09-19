/**
 * A transaction is a set of read and write operations on one or more documents.
 */
class Transaction {
  private transactionId?: string;
  private writes: FirestoreAPI.Write[] = [];
  private baseUrl: string;
  private basePath: string;
  private authToken: string;
  private isActive = false;

  /**
   * @param baseUrl The Firestore base URL
   * @param basePath The Firestore base path
   * @param authToken The authentication token
   */
  constructor(baseUrl: string, basePath: string, authToken: string) {
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
  begin(options?: FirestoreAPI.TransactionOptions): this {
    if (this.isActive) {
      throw new Error('Transaction is already active');
    }

    const request = new Request(this.baseUrl.replace('/documents/', '/documents:beginTransaction/'), this.authToken);
    const payload: FirestoreAPI.BeginTransactionRequest = {
      options: options || { readWrite: {} }
    };

    const response = request.post<FirestoreAPI.BeginTransactionResponse>('', payload);

    if (response.transaction) {
      try {
        // Decode the base64 transaction ID and re-encode it as URL-safe base64
        const cleanTransaction = response.transaction.replace(/\s+/g, '');
        const decoded = Utilities.base64Decode(cleanTransaction);
        this.transactionId = Utilities.base64EncodeWebSafe(decoded);
      } catch (error) {
        // Fallback: convert to URL-safe manually
        this.transactionId = response.transaction
          .replace(/\s+/g, '')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=/g, '');
      }
    }

    this.isActive = true;

    return this;
  }

  /**
   * Get a document within the transaction.
   *
   * @param path the path to the document
   * @return the document object
   */
  get(path: string): Document {
    if (!this.isActive) {
      throw new Error('Transaction is not active');
    }

    const request = new Request(this.baseUrl, this.authToken);
    request.addParam('transaction', this.transactionId!);

    const doc = request.get<FirestoreAPI.Document>(path);
    if (!doc.fields) {
      throw new Error('No document with `fields` found at path ' + path);
    }
    return new Document(doc, {} as Document);
  }

  /**
   * Get multiple documents within the transaction.
   *
   * @param paths array of document paths
   * @return array of documents
   */
  getAll(paths: string[]): Document[] {
    if (!this.isActive) {
      throw new Error('Transaction is not active');
    }

    const request = new Request(this.baseUrl.replace('/documents/', '/documents:batchGet/'), this.authToken);
    const absolutePaths = paths.map(path => this.basePath + path);
    const payload: FirestoreAPI.BatchGetDocumentsRequest = {
      documents: absolutePaths,
      transaction: this.transactionId
    };

    let documents = request.post<FirestoreAPI.BatchGetDocumentsResponse[]>('', payload);
    documents = documents.filter((docItem: FirestoreAPI.BatchGetDocumentsResponse) => docItem.found);

    return documents.map((docItem: FirestoreAPI.BatchGetDocumentsResponse) => {
      const doc = new Document(docItem.found!, { readTime: docItem.readTime } as Document);
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
  create(path: string, fields: Record<string, any>): this {
    if (!this.isActive) {
      throw new Error('Transaction is not active');
    }

    const pathDoc = Util_.getDocumentFromPath(path);
    const documentId = pathDoc[1];

    if (!documentId) {
      throw new Error('Document ID is required for transaction create operations');
    }

    const fullPath = this.getFullDocumentPath(path);
    const firestoreDocument = new Document(fields);

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
  set(path: string, fields: Record<string, any>, merge?: boolean): this {
    if (!this.isActive) {
      throw new Error('Transaction is not active');
    }

    const fullPath = this.getFullDocumentPath(path);
    const firestoreDocument = new Document(fields);

    const write: FirestoreAPI.Write = {
      update: {
        name: fullPath,
        fields: firestoreDocument.fields
      }
    };

    if (merge) {
      write.updateMask = {
        fieldPaths: Object.keys(fields).map(field => `\`${field.replace(/`/g, '\\`')}\``)
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
  update(path: string, fields: Record<string, any>, mask?: boolean | string[]): this {
    if (!this.isActive) {
      throw new Error('Transaction is not active');
    }

    const fullPath = this.getFullDocumentPath(path);
    const firestoreDocument = new Document(fields);

    const write: FirestoreAPI.Write = {
      update: {
        name: fullPath,
        fields: firestoreDocument.fields
      },
      currentDocument: {
        exists: true
      }
    };

    if (mask) {
      const maskData = typeof mask === 'boolean' ? Object.keys(fields) : mask;
      if (!Array.isArray(maskData)) {
        throw new Error('Mask must be a boolean or an array of strings!');
      }
      if (!maskData.length) {
        throw new Error('Missing fields in Mask!');
      }

      write.updateMask = {
        fieldPaths: maskData.map(field => `\`${field.replace(/`/g, '\\`')}\``)
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
  delete(path: string): this {
    if (!this.isActive) {
      throw new Error('Transaction is not active');
    }

    const fullPath = this.getFullDocumentPath(path);

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
  transform(path: string, field: string, transformation: FirestoreAPI.FieldTransform): this {
    if (!this.isActive) {
      throw new Error('Transaction is not active');
    }

    const fullPath = this.getFullDocumentPath(path);

    this.writes.push({
      transform: {
        document: fullPath,
        fieldTransforms: [
          {
            fieldPath: field,
            ...transformation
          }
        ]
      }
    });

    return this;
  }

  /**
   * Commit the transaction.
   *
   * @return array of write results
   */
  commit(): FirestoreAPI.WriteResult[] {
    if (!this.isActive) {
      throw new Error('Transaction is not active');
    }

    const request = new Request(this.baseUrl.replace('/documents/', '/documents:commit/'), this.authToken);
    const payload: FirestoreAPI.CommitRequest = {
      writes: this.writes,
      transaction: this.transactionId
    };

    const response = request.post<FirestoreAPI.CommitResponse>('', payload);

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
  rollback(): FirestoreAPI.Empty {
    if (!this.isActive) {
      throw new Error('Transaction is not active');
    }

    const request = new Request(this.baseUrl.replace('/documents/', '/documents:rollback/'), this.authToken);
    const payload = {
      transaction: this.transactionId
    };

    const response = request.post<FirestoreAPI.Empty>('', payload);

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
  getTransactionId(): string | undefined {
    return this.transactionId;
  }

  /**
   * Check if the transaction is active.
   *
   * @return true if the transaction is active
   */
  isTransactionActive(): boolean {
    return this.isActive;
  }

  /**
   * Convert a document path to a full Firestore document name.
   */
  private getFullDocumentPath(path: string): string {
    const cleanPath = Util_.cleanPath(path);
    return this.basePath.replace(/\/$/, '') + '/' + cleanPath.replace(/^\//, '');
  }
}