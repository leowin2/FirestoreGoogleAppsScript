interface QueryCallback {
  (query: Query): Document[];
}
/**
 * @see {@link https://firebase.google.com/docs/firestore/reference/rest/v1/StructuredQuery#Operator_1 FieldFilter Operator}
 */
enum FieldFilterOps_ {
  '==' = 'EQUAL',
  '===' = 'EQUAL',
  '!=' = 'NOT_EQUAL',
  '!==' = 'NOT_EQUAL',
  '<' = 'LESS_THAN',
  '<=' = 'LESS_THAN_OR_EQUAL',
  '>' = 'GREATER_THAN',
  '>=' = 'GREATER_THAN_OR_EQUAL',
  'contains' = 'ARRAY_CONTAINS',
  'containsany' = 'ARRAY_CONTAINS_ANY',
  'in' = 'IN',
  'notin' = 'NOT_IN',
  'not-in' = 'NOT_IN',
}
/**
 * @see {@link https://firebase.google.com/docs/firestore/reference/rest/v1/StructuredQuery#Operator_2 UnaryFilter Operator}
 */
enum UnaryFilterOps_ {
  'nan' = 'IS_NAN',
  'null' = 'IS_NULL',
}

/**
 * An internal object that acts as a Structured Query to be prepared before execution.
 * Chain methods to update query. Must call .execute to send request.
 *
 * @see {@link https://firebase.google.com/docs/firestore/reference/rest/v1/StructuredQuery Firestore Structured Query}
 */
class Query implements FirestoreAPI.StructuredQuery {
  select?: FirestoreAPI.Projection;
  from?: FirestoreAPI.CollectionSelector[];
  where?: FirestoreAPI.Filter;
  orderBy?: FirestoreAPI.Order[];
  startAt?: FirestoreAPI.Cursor;
  endAt?: FirestoreAPI.Cursor;
  offset?: number;
  limit?: number;
  callback: QueryCallback;

  /**
   * @param {string|string[]} from the base collection(s) to query
   * @param {QueryCallback} callback the function that is executed with the internally compiled query
   * @param {boolean} isCollectionGroup whether this is a collection group query
   */
  constructor(from: string | string[], callback: QueryCallback, isCollectionGroup: boolean = false) {
    this.callback = callback;
    if (from) {
      if (typeof from === 'string') {
        this.from = [{
          collectionId: from,
          allDescendants: isCollectionGroup
        }];
      } else {
        // Multiple collections
        this.from = from.map(collectionId => ({
          collectionId: collectionId,
          allDescendants: isCollectionGroup
        }));
      }
    }
  }

  // @see {@link https://firebase.google.com/docs/firestore/reference/rest/v1/StructuredQuery#FieldReference Field Reference}
  fieldRef_(field: string): FirestoreAPI.FieldReference {
    const escapedField = field
      .split('.')
      .map((f) => '`' + f.replace('`', '\\`') + '`')
      .join('.');
    return { fieldPath: escapedField };
  }

  // @see {@link https://firebase.google.com/docs/firestore/reference/rest/v1/StructuredQuery#FieldFilter Field Filter}
  fieldFilter_(field: string, operator: string, value: any): FirestoreAPI.FieldFilter {
    this.validateFieldFilter_(operator);
    return {
      field: this.fieldRef_(field),
      op: (FieldFilterOps_ as any)[operator],
      value: Document.wrapValue(value),
    };
  }

  // @see {@link https://firebase.google.com/docs/firestore/reference/rest/v1/StructuredQuery#UnaryFilter Unary Filter}
  unaryFilter_(operator: string, field: string): FirestoreAPI.UnaryFilter {
    this.validateUnaryFilter_(operator);
    return {
      field: this.fieldRef_(field),
      op: (UnaryFilterOps_ as any)[operator],
    };
  }

  // @see {@link https://firebase.google.com/docs/firestore/reference/rest/v1/StructuredQuery#order Order}
  order_(field: string, dir?: string): FirestoreAPI.Order {
    const isDesc = !(dir && (dir.substr(0, 3).toUpperCase() === 'DEC' || dir.substr(0, 4).toUpperCase() === 'DESC'));
    const direction: string = isDesc ? 'ASCENDING' : 'DESCENDING';
    return {
      direction: direction,
      field: this.fieldRef_(field),
    };
  }

  validateFieldFilter_(val: string): val is FieldFilterOps_ {
    if (!(val in FieldFilterOps_)) {
      throw new Error(`Operator '${val}' not within ${Object.keys(FieldFilterOps_)}`);
    }
    return true;
  }
  validateUnaryFilter_(val: string): val is UnaryFilterOps_ {
    if (!(val in UnaryFilterOps_)) {
      throw new Error(`Operator '${val}' not within ${Object.keys(UnaryFilterOps_)}`);
    }
    return true;
  }

  filter_(field: string, operator: string | number | null, value: any): FirestoreAPI.Filter {
    if (typeof operator === 'string') {
      operator = operator.toLowerCase().replace('_', '') as FilterOp;
    } else if (value == null) {
      // Covers null and undefined values
      operator = 'null';
    } else if (Util_.isNumberNaN(value)) {
      // Covers NaN
      operator = 'nan';
    }

    if ((operator as string) in FieldFilterOps_) {
      return {
        fieldFilter: this.fieldFilter_(field, operator as string, value),
      };
    }

    if ((operator as string) in UnaryFilterOps_) {
      return {
        unaryFilter: this.unaryFilter_(operator as string, field),
      };
    }
    throw new Error('Invalid Operator given: ' + operator);
  }

  /**
   * Select Query which can narrow which fields to return.
   * Can be repeated if multiple fields are needed in the response.
   *
   * @see {@link https://firebase.google.com/docs/firestore/reference/rest/v1/StructuredQuery#Projection Select}
   * @param {string} field The field to narrow down (if empty, returns name of document)
   * @return {this} this query object for chaining
   */
  Select(field?: string): this {
    if (!field || !field.trim()) {
      // Catch undefined or blank strings and return document name
      field = '__name__';
    }
    if (!this.select) {
      this.select = { fields: [] };
    }
    this.select['fields']!.push(this.fieldRef_(field));
    return this;
  }

  /**
   * Filter Query by a given field and operator (or additionally a value).
   * Can be repeated if multiple filters required.
   * Results must satisfy all filters.
   *
   * @param {string} field The field to reference for filtering
   * @param {string} operator The operator to filter by. {@link fieldOps} {@link unaryOps}
   * @param {any} [value] Object to set the field value to. Null if using a unary operator.
   * @return {this} this query object for chaining
   */
  Where(field: string, operator: string | number | null, value?: any): this {
    if (this.where) {
      if (!this.where.compositeFilter) {
        this.where = {
          compositeFilter: {
            op: 'AND', // Currently "OR" is unsupported
            filters: [this.where],
          },
        };
      }
      this.where.compositeFilter!.filters!.push(this.filter_(field, operator, value));
    } else {
      this.where = this.filter_(field, operator, value);
    }
    return this;
  }

  /**
   * Orders the Query results based on a field and specific direction.
   * Can be repeated if additional ordering is needed.
   *
   * @see {@link https://firebase.google.com/docs/firestore/reference/rest/v1/StructuredQuery#Projection Select}
   * @param {string} field The field to order by.
   * @param {string} dir The direction to order the field by. Should be one of "asc" or "desc". Defaults to Ascending.
   * @return {this} this query object for chaining
   */
  OrderBy(field: string, dir?: string): this {
    if (!this.orderBy) {
      this.orderBy = [];
    }

    this.orderBy!.push(this.order_(field, dir));
    return this;
  }

  /**
   * Offsets the Query results by a given number of documents.
   *
   * @param {number} offset Number of results to skip
   * @return {this} this query object for chaining
   */
  Offset(offset: number): this {
    if (!Util_.isNumeric(offset)) {
      throw new TypeError('Offset is not a valid number!');
    } else if (offset < 0) {
      throw new RangeError('Offset must be >= 0!');
    }
    this.offset = offset;
    return this;
  }

  /**
   * Limits the amount Query results returned.
   *
   * @param {number} limit Number of results limit
   * @return {this} this query object for chaining
   */
  Limit(limit: number): this {
    if (!Util_.isNumeric(limit)) {
      throw new TypeError('Limit is not a valid number!');
    } else if (limit < 0) {
      throw new RangeError('Limit must be >= 0!');
    }
    this.limit = limit;
    return this;
  }

  /**
   * Sets the range of Query results returned.
   *
   * @param {number} start Start result number (inclusive)
   * @param {number} end End result number (inclusive)
   * @return {this} this query object for chaining
   */
  Range(start: number, end: number): this {
    if (!Util_.isNumeric(start)) {
      throw new TypeError('Range start is not a valid number!');
    } else if (!Util_.isNumeric(end)) {
      throw new TypeError('Range end is not a valid number!');
    } else if (start < 0) {
      throw new RangeError('Range start must be >= 0!');
    } else if (end < 0) {
      throw new RangeError('Range end must be >= 0!');
    } else if (start >= end) {
      throw new RangeError('Range start must be less than range end!');
    }

    this.offset = start;
    this.limit = end - start;
    return this;
  }

  /**
   * Filter Query with OR composite filter.
   * Results must satisfy at least one of the provided filters.
   *
   * @param {FirestoreAPI.Filter[]} filters Array of filters to combine with OR
   * @return {this} this query object for chaining
   */
  WhereOr(filters: FirestoreAPI.Filter[]): this {
    if (filters.length < 2) {
      throw new Error('OR filter requires at least 2 filters');
    }

    const orFilter: FirestoreAPI.Filter = {
      compositeFilter: {
        op: 'OR',
        filters: filters
      }
    };

    if (this.where) {
      // If there's already a where clause, combine with AND
      if (!this.where.compositeFilter || this.where.compositeFilter.op !== 'AND') {
        this.where = {
          compositeFilter: {
            op: 'AND',
            filters: [this.where, orFilter]
          }
        };
      } else {
        this.where.compositeFilter.filters!.push(orFilter);
      }
    } else {
      this.where = orFilter;
    }

    return this;
  }

  /**
   * Add a start cursor for pagination.
   * Results will start after the provided values.
   *
   * @param {...any} values Values that represent a position
   * @param {boolean} before Whether the position is just before the given values
   * @return {this} this query object for chaining
   */
  StartAfter(...values: any[]): this {
    this.startAt = {
      values: values.map(Document.wrapValue),
      before: false
    };
    return this;
  }

  /**
   * Add a start cursor for pagination.
   * Results will start at the provided values.
   *
   * @param {...any} values Values that represent a position
   * @return {this} this query object for chaining
   */
  StartAt(...values: any[]): this {
    this.startAt = {
      values: values.map(Document.wrapValue),
      before: true
    };
    return this;
  }

  /**
   * Add an end cursor for pagination.
   * Results will end before the provided values.
   *
   * @param {...any} values Values that represent a position
   * @return {this} this query object for chaining
   */
  EndBefore(...values: any[]): this {
    this.endAt = {
      values: values.map(Document.wrapValue),
      before: true
    };
    return this;
  }

  /**
   * Add an end cursor for pagination.
   * Results will end at the provided values.
   *
   * @param {...any} values Values that represent a position
   * @return {this} this query object for chaining
   */
  EndAt(...values: any[]): this {
    this.endAt = {
      values: values.map(Document.wrapValue),
      before: false
    };
    return this;
  }

  /**
   * Add additional collections to this query.
   * This allows querying multiple collections in a single query.
   *
   * @param {string|string[]} collections The collection(s) to add to the query
   * @param {boolean} asCollectionGroup Whether to treat added collections as collection groups
   * @return {this} this query object for chaining
   */
  addCollections(collections: string | string[], asCollectionGroup: boolean = false): this {
    if (!this.from) {
      this.from = [];
    }

    const collectionsArray = typeof collections === 'string' ? [collections] : collections;

    for (const collectionId of collectionsArray) {
      // Check if collection is already in the from clause
      const exists = this.from.some(selector => selector.collectionId === collectionId);
      if (!exists) {
        this.from.push({
          collectionId: collectionId,
          allDescendants: asCollectionGroup
        });
      }
    }

    return this;
  }

  /**
   * Add additional collection groups to this query.
   * This is a convenience method for addCollections with asCollectionGroup=true.
   *
   * @param {string|string[]} collections The collection group(s) to add to the query
   * @return {this} this query object for chaining
   */
  addCollectionGroups(collections: string | string[]): this {
    return this.addCollections(collections, true);
  }

  /**
   * Remove collections from this query.
   *
   * @param {string|string[]} collections The collection(s) to remove from the query
   * @return {this} this query object for chaining
   */
  removeCollections(collections: string | string[]): this {
    if (!this.from) {
      return this;
    }

    const collectionsArray = typeof collections === 'string' ? [collections] : collections;

    this.from = this.from.filter(selector =>
      !collectionsArray.includes(selector.collectionId!)
    );

    return this;
  }

  /**
   * Get all collections currently in this query's FROM clause.
   *
   * @return {string[]} Array of collection IDs
   */
  getCollections(): string[] {
    return this.from ? this.from.map(selector => selector.collectionId!).filter(Boolean) : [];
  }

  /**
   * Create a filter object that can be used with WhereOr.
   *
   * @param {string} field The field to reference for filtering
   * @param {string} operator The operator to filter by
   * @param {any} value Object to set the field value to
   * @return {FirestoreAPI.Filter} A filter object
   */
  static createFilter(field: string, operator: string, value?: any): FirestoreAPI.Filter {
    const tempQuery = new Query('temp', () => [], false);
    return tempQuery.filter_(field, operator, value);
  }

  /**
   * Executes the query with the given callback method and the generated query.
   * Must be used at the end of any query for execution.
   *
   * @return {Document[]} The query results from the execution
   */
  Execute(): Document[] {
    return this.callback(this); // Not using callback.bind due to debugging limitations of GAS
  }
}
