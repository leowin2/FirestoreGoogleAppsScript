interface AggregateQueryCallback {
  (query: AggregateQuery): Record<string, any>;
}

/**
 * Represents an aggregation over a collection.
 */
class AggregateQuery {
  private baseQuery?: FirestoreAPI.StructuredQuery;
  private aggregations: FirestoreAPI.Aggregation[] = [];
  private callback: AggregateQueryCallback;

  /**
   * @param baseQuery [Optional] The base query to aggregate over
   * @param callback The function that executes the aggregation query
   */
  constructor(baseQuery: FirestoreAPI.StructuredQuery | undefined, callback: AggregateQueryCallback) {
    this.baseQuery = baseQuery;
    this.callback = callback;
  }

  /**
   * Add a COUNT aggregation.
   *
   * @param alias [Optional] The alias for this aggregation
   * @param upTo [Optional] Maximum count to return (for performance)
   * @return this AggregateQuery for chaining
   */
  count(alias?: string, upTo?: number): this {
    const aggregation: FirestoreAPI.Aggregation = {
      alias: alias || 'count',
      count: upTo ? { upTo: upTo } : {}
    };

    this.aggregations.push(aggregation);
    return this;
  }

  /**
   * Add a SUM aggregation for a numeric field.
   *
   * @param field The field to sum
   * @param alias [Optional] The alias for this aggregation
   * @return this AggregateQuery for chaining
   */
  sum(field: string, alias?: string): this {
    const aggregation: FirestoreAPI.Aggregation = {
      alias: alias || `sum_${field}`,
      sum: {
        field: this.fieldRef_(field)
      }
    };

    this.aggregations.push(aggregation);
    return this;
  }

  /**
   * Add an AVG aggregation for a numeric field.
   *
   * @param field The field to average
   * @param alias [Optional] The alias for this aggregation
   * @return this AggregateQuery for chaining
   */
  avg(field: string, alias?: string): this {
    const aggregation: FirestoreAPI.Aggregation = {
      alias: alias || `avg_${field}`,
      avg: {
        field: this.fieldRef_(field)
      }
    };

    this.aggregations.push(aggregation);
    return this;
  }

  /**
   * Execute the aggregation query.
   *
   * @return Object containing the aggregation results
   */
  get(): Record<string, any> {
    if (this.aggregations.length === 0) {
      throw new Error('At least one aggregation must be specified');
    }
    if (this.aggregations.length > 5) {
      throw new Error('Maximum 5 aggregations per query');
    }

    return this.callback(this);
  }

  /**
   * Get the structured aggregation query for the API call.
   *
   * @return The structured aggregation query
   */
  getStructuredAggregationQuery(): FirestoreAPI.StructuredAggregationQuery {
    return {
      structuredQuery: this.baseQuery,
      aggregations: this.aggregations
    };
  }

  /**
   * Create a field reference.
   *
   * @param field The field name
   * @return The field reference
   */
  private fieldRef_(field: string): FirestoreAPI.FieldReference {
    const escapedField = field
      .split('.')
      .map((f) => '`' + f.replace('`', '\\`') + '`')
      .join('.');
    return { fieldPath: escapedField };
  }
}

/**
 * Type definition for structured aggregation query
 */
declare namespace FirestoreAPI {
  interface StructuredAggregationQuery {
    structuredQuery?: StructuredQuery;
    aggregations?: Aggregation[];
  }

  interface Aggregation {
    alias?: string;
    count?: Count;
    sum?: Sum;
    avg?: Avg;
  }

  interface Count {
    upTo?: number;
  }

  interface Sum {
    field?: FieldReference;
  }

  interface Avg {
    field?: FieldReference;
  }

  interface RunAggregationQueryRequest {
    structuredAggregationQuery?: StructuredAggregationQuery;
    transaction?: string;
    newTransaction?: TransactionOptions;
    readTime?: string;
  }

  interface RunAggregationQueryResponse {
    result?: AggregationResult[];
    transaction?: string;
    readTime?: string;
  }

  interface AggregationResult {
    aggregateFields?: Record<string, Value>;
  }
}