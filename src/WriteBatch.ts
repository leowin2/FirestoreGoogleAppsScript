/**
 * A write batch that can be used to perform multiple write operations atomically.
 */
class WriteBatch {
  private writes: FirestoreAPI.Write[] = [];
  private baseUrl: string;
  private basePath: string;
  private authToken: string;

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
   * Create a document with the given fields and optional ID.
   *
   * @param path the path where the document will be written
   * @param fields the document's fields
   * @return this WriteBatch instance for chaining
   */
  create(path: string, fields: Record<string, any>): this {
    const pathDoc = Util_.getDocumentFromPath(path);
    const documentId = pathDoc[1];

    if (!documentId) {
      throw new Error('Document ID is required for batch create operations');
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
   * Set a document with the given fields (overwrites existing document).
   *
   * @param path the path where the document will be written
   * @param fields the document's fields
   * @param merge whether to merge with existing document
   * @return this WriteBatch instance for chaining
   */
  set(path: string, fields: Record<string, any>, merge?: boolean): this {
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
   * Update a document with the given fields.
   *
   * @param path the path of the document to update
   * @param fields the document's new fields
   * @param mask if true, the update will mask the given fields
   * @return this WriteBatch instance for chaining
   */
  update(path: string, fields: Record<string, any>, mask?: boolean | string[]): this {
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
   * Delete a document.
   *
   * @param path the path to the document to delete
   * @return this WriteBatch instance for chaining
   */
  delete(path: string): this {
    const fullPath = this.getFullDocumentPath(path);

    this.writes.push({
      delete: fullPath
    });

    return this;
  }

  /**
   * Apply field transforms to a document.
   *
   * @param path the path to the document
   * @param transforms the field transforms to apply
   * @return this WriteBatch instance for chaining
   */
  transform(path: string, transforms: Record<string, any>): this {
    const fullPath = this.getFullDocumentPath(path);
    const fieldTransforms: FirestoreAPI.FieldTransform[] = [];

    for (const [field, transform] of Object.entries(transforms)) {
      if (transform === 'serverTimestamp') {
        fieldTransforms.push({
          fieldPath: `\`${field.replace(/`/g, '\\`')}\``,
          setToServerValue: 'REQUEST_TIME'
        });
      } else if (transform && typeof transform === 'object') {
        if (transform.increment !== undefined) {
          fieldTransforms.push({
            fieldPath: `\`${field.replace(/`/g, '\\`')}\``,
            increment: Document.wrapValue(transform.increment)
          });
        } else if (transform.arrayUnion) {
          fieldTransforms.push({
            fieldPath: `\`${field.replace(/`/g, '\\`')}\``,
            appendMissingElements: {
              values: Array.isArray(transform.arrayUnion)
                ? transform.arrayUnion.map(Document.wrapValue)
                : [Document.wrapValue(transform.arrayUnion)]
            }
          });
        } else if (transform.arrayRemove) {
          fieldTransforms.push({
            fieldPath: `\`${field.replace(/`/g, '\\`')}\``,
            removeAllFromArray: {
              values: Array.isArray(transform.arrayRemove)
                ? transform.arrayRemove.map(Document.wrapValue)
                : [Document.wrapValue(transform.arrayRemove)]
            }
          });
        }
      }
    }

    if (fieldTransforms.length > 0) {
      this.writes.push({
        transform: {
          document: fullPath,
          fieldTransforms: fieldTransforms
        }
      });
    }

    return this;
  }

  /**
   * Commit all batched writes.
   *
   * @return array of write results
   */
  commit(): FirestoreAPI.WriteResult[] {
    if (this.writes.length === 0) {
      throw new Error('Cannot commit empty batch');
    }

    // Fix the URL construction for batchWrite
    const batchWriteUrl = this.baseUrl.replace(/\/$/, '') + ':batchWrite';

    const request = new Request(batchWriteUrl, this.authToken);
    const payload: FirestoreAPI.BatchWriteRequest = {
      writes: this.writes
    };

    const response = request.post<FirestoreAPI.BatchWriteResponse>('', payload);

    // Clear writes after commit
    this.writes = [];

    // Check for errors in individual write results
    if (response.status) {
      for (let i = 0; i < response.status.length; i++) {
        const status = response.status[i];
        if (status.code && status.code !== 0) {
          throw new Error(`Batch write operation ${i} failed: ${status.message || 'Unknown error'}`);
        }
      }
    }

    return response.writeResults || [];
  }

  /**
   * Get the number of writes in this batch.
   *
   * @return the number of writes
   */
  size(): number {
    return this.writes.length;
  }

  /**
   * Convert a document path to a full Firestore document name.
   */
  private getFullDocumentPath(path: string): string {
    const cleanPath = Util_.cleanDocumentPath(path);

    // Return just the Firestore document path, not the full URL
    // basePath already contains: projects/{project}/databases/(default)/documents/
    return this.basePath.replace(/\/$/, '') + '/' + cleanPath.replace(/^\//, '');
  }
}