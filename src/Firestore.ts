/* eslint @typescript-eslint/no-unused-vars: ["error", { "varsIgnorePattern": "^getFirestore$" }] */

/**
 * An authenticated interface to a Firestore project.
 */
class Firestore implements FirestoreRead, FirestoreWrite, FirestoreDelete {
  auth: Auth;
  basePath: string;
  baseUrl: string;

  /**
   * Constructor
   *
   * @param {string} email the user email address (for authentication)
   * @param {string} key the user private key (for authentication)
   * @param {string} projectId the Firestore project ID
   * @param {string} apiVersion [Optional] The Firestore API Version ("v1beta1", "v1beta2", or "v1")
   * @return {Firestore} an authenticated interface with a Firestore project (constructor)
   */
  constructor(email: string, key: string, projectId: string, apiVersion: Version = 'v1') {
    // The authentication token used for accessing Firestore
    this.auth = new Auth(email, key);
    this.basePath = `projects/${projectId}/databases/(default)/documents/`;
    this.baseUrl = `https://firestore.googleapis.com/${apiVersion}/${this.basePath}`;
  }

  get authToken(): string {
    return this.auth.accessToken;
  }
  get_ = FirestoreRead.prototype.get_;
  getPage_ = FirestoreRead.prototype.getPage_;
  getDocumentResponsesFromCollection_ = FirestoreRead.prototype.getDocumentResponsesFromCollection_;

  /**
   * Get a document.
   *
   * @param {string} path the path to the document
   * @return {object} the document object
   */
  getDocument(path: string): Document {
    const request = new Request(this.baseUrl, this.authToken);
    return this.getDocument_(path, request);
  }
  getDocument_ = FirestoreRead.prototype.getDocument_;

  /**
   * Get a list of all documents in a collection.
   *
   * @param {string} path the path to the collection
   * @param {array} ids [Optional] String array of document names to filter. Missing documents will not be included.
   * @return {object} an array of the documents in the collection
   */
  getDocuments(path: string, ids?: string[]): Document[] {
    let docs: Document[];
    if (!ids) {
      docs = this.query(path).Execute() as Document[];
    } else {
      const request = new Request(this.baseUrl.replace('/documents/', '/documents:batchGet/'), this.authToken);
      docs = this.getDocuments_(this.basePath + Util_.cleanDocumentPath(path), request, ids);
    }
    return docs;
  }
  getDocuments_ = FirestoreRead.prototype.getDocuments_;

  /**
   * Get a list of all IDs of the documents in a path
   *
   * @param {string} path the path to the collection
   * @return {object} an array of IDs of the documents in the collection
   */
  getDocumentIds(path: string): string[] {
    const request = new Request(this.baseUrl, this.authToken);
    return this.getDocumentIds_(path, request);
  }
  getDocumentIds_ = FirestoreRead.prototype.getDocumentIds_;

  /**
   * Create a document with the given fields and an auto-generated ID.
   *
   * @param {string} path the path where the document will be written
   * @param {object} fields the document's fields
   * @return {object} the Document object written to Firestore
   */
  createDocument(path: string, fields?: Record<string, any>): Document {
    const request = new Request(this.baseUrl, this.authToken);
    return this.createDocument_(path, fields || {}, request);
  }

  createDocument_ = FirestoreWrite.prototype.createDocument_;

  /**
   * Update/patch a document at the given path with new fields.
   *
   * @param {string} path the path of the document to update. If document name not provided, a random ID will be generated.
   * @param {object} fields the document's new fields
   * @param {boolean|string[]} mask if true, the update will mask the given fields,
   * if is an array (of field names), that array would be used as the mask.
   * (that way you can, for example, include a field in `mask`, but not in `fields`, and by doing so, delete that field)
   * @return {object} the Document object written to Firestore
   */
  updateDocument(path: string, fields: Record<string, any>, mask?: boolean | string[]): Document {
    const request = new Request(this.baseUrl, this.authToken);
    return this.updateDocument_(path, fields, request, mask);
  }

  updateDocument_ = FirestoreWrite.prototype.updateDocument_;

  /**
   * Delete the Firestore document at the given path.
   * Note: this deletes ONLY this document, and not any subcollections.
   *
   * @param {string} path the path to the document to delete
   * @return {object} the JSON response from the DELETE request
   */
  deleteDocument(path: string): FirestoreAPI.Empty {
    const request = new Request(this.baseUrl, this.authToken);
    return this.deleteDocument_(path, request);
  }

  deleteDocument_ = FirestoreDelete.prototype.deleteDocument_;

  /**
   * Run a query against the Firestore Database and return an all the documents that match the query.
   * Must call .Execute() to send the request.
   *
   * @param {string} path to query
   * @return {object} the JSON response from the GET request
   */
  query(path: string): Query {
    const request = new Request(this.baseUrl, this.authToken);
    return this.query_(path, request);
  }
  query_ = FirestoreRead.prototype.query_;
  collectionGroupQuery_ = FirestoreRead.prototype.collectionGroupQuery_;
  multiCollectionQuery_ = FirestoreRead.prototype.multiCollectionQuery_;
  multiCollectionGroupQuery_ = FirestoreRead.prototype.multiCollectionGroupQuery_;

  /**
   * Query across all collections with the given collection ID.
   * This allows you to query documents from collections with the same name
   * across different parent documents.
   *
   * @param {string} collectionId the collection ID to query across all documents
   * @return {Query} the Query object for chaining and execution
   */
  collectionGroup(collectionId: string): Query {
    const request = new Request(this.baseUrl, this.authToken);
    return this.collectionGroupQuery_(collectionId, request);
  }

  /**
   * Query multiple specific collections in a single query.
   * This allows you to query documents from multiple different collections.
   *
   * @param {string[]} collectionPaths array of collection paths to query
   * @return {Query} the Query object for chaining and execution
   */
  queryMultipleCollections(collectionPaths: string[]): Query {
    const request = new Request(this.baseUrl, this.authToken);
    return this.multiCollectionQuery_(collectionPaths, request);
  }

  /**
   * Query multiple collection groups in a single query.
   * This combines collection group functionality with multi-collection querying.
   *
   * @param {string[]} collectionIds array of collection IDs to query as groups
   * @return {Query} the Query object for chaining and execution
   */
  queryMultipleCollectionGroups(collectionIds: string[]): Query {
    const request = new Request(this.baseUrl, this.authToken);
    return this.multiCollectionGroupQuery_(collectionIds, request);
  }

  /**
   * Create a new WriteBatch instance for performing multiple write operations atomically.
   *
   * @return {WriteBatch} a new WriteBatch instance
   */
  batch(): WriteBatch {
    return new WriteBatch(this.baseUrl, this.basePath, this.authToken);
  }

  /**
   * Perform multiple write operations in a single batch without transactions.
   * Note: Operations are not atomic - each operation succeeds or fails independently.
   *
   * @param {FirestoreAPI.Write[]} writes array of write operations
   * @return {FirestoreAPI.WriteResult[]} array of write results
   */
  batchWrite(writes: FirestoreAPI.Write[]): FirestoreAPI.WriteResult[] {
    if (!writes || writes.length === 0) {
      throw new Error('Cannot perform batch write with empty writes array');
    }

    const request = new Request(this.baseUrl.replace(/\/$/, '') + ':batchWrite', this.authToken);
    const payload: FirestoreAPI.BatchWriteRequest = {
      writes: writes
    };

    const response = request.post<FirestoreAPI.BatchWriteResponse>('', payload);

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
   * Create a new Transaction instance for performing multiple operations atomically.
   *
   * @return {Transaction} a new Transaction instance
   */
  transaction(): Transaction {
    return new Transaction(this.baseUrl, this.basePath, this.authToken);
  }

  /**
   * Execute a transaction with automatic retry logic.
   *
   * @param {function} updateFunction function that receives a Transaction and performs operations
   * @param {object} options transaction options (readOnly vs readWrite)
   * @param {number} maxRetries maximum number of retries (default: 5)
   * @return {any} the result returned by the updateFunction
   */
  runTransaction<T>(
    updateFunction: (transaction: Transaction) => T,
    options?: FirestoreAPI.TransactionOptions,
    maxRetries: number = 5
  ): T {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const transaction = this.transaction();

      try {
        // Begin the transaction
        transaction.begin(options);

        // Execute the user function
        const result = updateFunction(transaction);

        // Commit the transaction
        transaction.commit();

        return result;
      } catch (error) {
        lastError = error as Error;

        // Rollback if transaction is still active
        if (transaction.isTransactionActive()) {
          try {
            transaction.rollback();
          } catch (rollbackError) {
            // Ignore rollback errors, focus on original error
          }
        }

        // Check if error is retryable
        if (this.isRetryableError(error as Error) && attempt < maxRetries) {
          // Wait with exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          Utilities.sleep(delay);
          continue;
        }

        // If not retryable or max retries exceeded, throw the error
        throw error;
      }
    }

    throw lastError || new Error('Transaction failed after maximum retries');
  }

  /**
   * Check if an error is retryable (usually due to contention).
   */
  private isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return (
      message.includes('aborted') ||
      message.includes('conflict') ||
      message.includes('contention') ||
      message.includes('too much contention') ||
      message.includes('deadline exceeded')
    );
  }

  /**
   * Create an aggregation query over a collection.
   *
   * @param path the path to the collection
   * @return AggregateQuery instance for building aggregations
   */
  aggregateQuery(path: string): AggregateQuery {
    const grouped = Util_.getCollectionFromPath(path);
    const request = new Request(this.baseUrl, this.authToken);
    request.route('runAggregationQuery');

    const callback = (aggregateQuery: AggregateQuery): Record<string, any> => {
      const payload: FirestoreAPI.RunAggregationQueryRequest = {
        structuredAggregationQuery: aggregateQuery.getStructuredAggregationQuery()
      };

      const response = request.post<FirestoreAPI.RunAggregationQueryResponse>(grouped[0], payload);

      // Handle response format - the response is directly an array of results
      const results = Array.isArray(response) ? response : [response];

      if (results && results.length > 0 && results[0]?.result?.aggregateFields) {
        const result: Record<string, any> = {};
        for (const [alias, value] of Object.entries(results[0].result.aggregateFields)) {
          result[alias] = Document.unwrapValue(value);
        }
        return result;
      }

      // Fallback: return raw response if structure doesn't match
      console.log('Unexpected aggregate response structure, returning raw response');
      return response;
    };

    // Get base query if needed
    const baseQuery: FirestoreAPI.StructuredQuery = {
      from: [{ collectionId: grouped[1] }]
    };

    return new AggregateQuery(baseQuery, callback);
  }

  /**
   * Create an aggregation query over a collection group.
   *
   * @param collectionId the collection ID to aggregate across all documents
   * @return AggregateQuery instance for building aggregations
   */
  aggregateCollectionGroup(collectionId: string): AggregateQuery {
    const request = new Request(this.baseUrl, this.authToken);
    request.route('runAggregationQuery');

    const callback = (aggregateQuery: AggregateQuery): Record<string, any> => {
      const payload: FirestoreAPI.RunAggregationQueryRequest = {
        structuredAggregationQuery: aggregateQuery.getStructuredAggregationQuery()
      };

      const response = request.post<FirestoreAPI.RunAggregationQueryResponse>('', payload);

      // Debug logging
      console.log('AggregateCollectionGroup Response:', JSON.stringify(response));

      // Handle response format - the response is directly an array of results
      const results = Array.isArray(response) ? response : [response];

      if (results && results.length > 0 && results[0]?.result?.aggregateFields) {
        const result: Record<string, any> = {};
        for (const [alias, value] of Object.entries(results[0].result.aggregateFields)) {
          result[alias] = Document.unwrapValue(value);
        }
        return result;
      }

      // Fallback: return raw response if structure doesn't match
      console.log('Unexpected aggregate response structure, returning raw response');
      return response;
    };

    // Create base query for collection group
    const baseQuery: FirestoreAPI.StructuredQuery = {
      from: [{
        collectionId: collectionId,
        allDescendants: true
      }]
    };

    return new AggregateQuery(baseQuery, callback);
  }

  /**
   * Create an aggregation query from an existing Query.
   *
   * @param query the base query to aggregate over
   * @return AggregateQuery instance for building aggregations
   */
  aggregateFromQuery(query: Query): AggregateQuery {
    const request = new Request(this.baseUrl, this.authToken);
    request.route('runAggregationQuery');

    const callback = (aggregateQuery: AggregateQuery): Record<string, any> => {
      const payload: FirestoreAPI.RunAggregationQueryRequest = {
        structuredAggregationQuery: aggregateQuery.getStructuredAggregationQuery()
      };

      const response = request.post<FirestoreAPI.RunAggregationQueryResponse>('', payload);

      // Debug logging

      // Handle response format - the response is directly an array of results
      const results = Array.isArray(response) ? response : [response];

      if (results && results.length > 0 && results[0]?.result?.aggregateFields) {
        const result: Record<string, any> = {};
        for (const [alias, value] of Object.entries(results[0].result.aggregateFields)) {
          result[alias] = Document.unwrapValue(value);
        }
        return result;
      }

      // Fallback: return raw response if structure doesn't match
      console.log('Unexpected aggregate response structure, returning raw response');
      return response;
    };

    return new AggregateQuery(query as FirestoreAPI.StructuredQuery, callback);
  }
}

type Version = 'v1' | 'v1beta1' | 'v1beta2';

/**
 * Get an object that acts as an authenticated interface with a Firestore project.
 *
 * @param {string} email the user email address (for authentication)
 * @param {string} key the user private key (for authentication)
 * @param {string} projectId the Firestore project ID
 * @param {string} apiVersion [Optional] The Firestore API Version ("v1beta1", "v1beta2", or "v1")
 * @return {Firestore} an authenticated interface with a Firestore project (function)
 */
function getFirestore(email: string, key: string, projectId: string, apiVersion: Version = 'v1'): Firestore {
  return new Firestore(email, key, projectId, apiVersion);
}
