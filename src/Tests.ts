function StoreCredentials_(): void {
  /** DO NOT SAVE CREDENTIALS HERE */
  const email = 'xxx@appspot.gserviceaccount.com';
  const key = '-----BEGIN PRIVATE KEY-----\nLine\nLine\n-----END PRIVATE KEY-----';
  const projectId = 'xxx';
  PropertiesService.getUserProperties().setProperties({
    email: email,
    key: key,
    project: projectId,
  });
}

class Tests implements TestManager {
  db!: Firestore;
  pass: string[];
  fail: Map<string, Error>;
  expected_!: Record<string, Value>;

  constructor(email: string, key: string, projectId: string, apiVersion: Version = 'v1', clearCollection = false) {
    this.pass = [];
    this.fail = new Map<string, Error>();

    let funcs = Object.getOwnPropertyNames(Tests.prototype).filter(
      (property) => typeof (this as any)[property] === 'function' && property !== 'constructor'
    );

    /** Test Initializer */
    try {
      this.db = getFirestore(email, key, projectId, apiVersion);
      this.pass.push('Test_Get_Firestore');
    } catch (e) {
      // On failure, fail the remaining tests without execution
      this.fail.set('Test_Get_Firestore', e);
      const err = new Error('Test Initialization Error');
      err.stack = 'See Test_Get_Firestore Error';
      for (const func of funcs) {
        this.fail.set(func, err);
      }
      return;
    }

    this.expected_ = {
      'array value': ['string123', 42, false, { 'nested map property': 123 }],
      'number value': 100,
      'string value 이': 'The fox jumps over the lazy dog 름',
      'boolean value': true,
      'map value (nested object)': {
        foo: 'bar',
      },
      'null value': null,
      'timestamp value': new Date(),
      'geopoint value': {
        latitude: 29.9792,
        longitude: 31.1342,
      },
      'reference value': this.db.basePath + 'Test Collection/New Document',
    };

    /** Only run test to remove residual Test Documents **/
    if (clearCollection) {
      funcs = ['Test_Delete_Documents'];
    }

    /** Test all methods in this class */
    for (const func of funcs) {
      try {
        (this as any)[func]();
        this.pass.push(func);
      } catch (e) {
        if (typeof e === 'string') {
          const err = new Error('AssertionError');
          err.stack = e;
          // eslint-disable-next-line no-ex-assign
          e = err;
        }
        this.fail.set(func, e);
      }
    }
  }

  /**
   * All Test methods should not take any parameters, and return nothing.
   * Tests should throw exceptions to fail.
   * Can leverage {@link https://sites.google.com/site/scriptsexamples/custom-methods/gsunit GSUnit}.
   */
  Test_Create_Document_Bare(): void {
    const path = 'Test Collection';
    const newDoc = this.db.createDocument(path);
    GSUnit.assertNotUndefined(newDoc);
    GSUnit.assertNotUndefined(newDoc.name);
    GSUnit.assertTrue(newDoc.name!.startsWith(this.db.basePath + path + '/'));
    GSUnit.assertNotUndefined(newDoc.createTime);
    GSUnit.assertNotUndefined(newDoc.updateTime);
    GSUnit.assertEquals(newDoc.createTime, newDoc.updateTime);
    GSUnit.assertRoughlyEquals(+new Date(), +newDoc.created, 1000);
  }

  Test_Create_Document_Name(): void {
    const path = 'Test Collection/New Document';
    const newDoc = this.db.createDocument(path);
    GSUnit.assertNotUndefined(newDoc);
    GSUnit.assertEquals(path, newDoc.path);
    GSUnit.assertEquals(this.db.basePath + path, newDoc.name);
    GSUnit.assertNotUndefined(newDoc.createTime);
    GSUnit.assertNotUndefined(newDoc.updateTime);
    GSUnit.assertRoughlyEquals(+new Date(), +newDoc.updated, 1000);
  }

  Test_Create_Document_Name_Duplicate(): void {
    const path = 'Test Collection/New Document';
    try {
      this.db.createDocument(path);
      GSUnit.fail('Duplicate document without error');
    } catch (e) {
      if (e.message !== `Document already exists: ${this.db.basePath}${path}`) {
        throw e;
      }
    }
  }

  Test_Create_Document_Data(): void {
    const path = 'Test Collection/New Document !@#$%^&*(),.<>?;\':"[]{}|-=_+áéíóúæÆÑ';
    const newDoc = this.db.createDocument(path, this.expected_);
    GSUnit.assertEquals(path, newDoc.path);
    GSUnit.assertObjectEquals(this.expected_, newDoc.obj);
  }

  Test_Update_Document_Overwrite_Default(): void {
    const original = {
      'number value': -100,
      'string value 이': 'The fox jumps over the lazy dog 름',
    };
    const path = 'Test Collection/Updatable Document Default';
    this.db.createDocument(path, original);
    const expected = {
      'string value 이': 'Qwerty निर्वाण',
      'null value': 'Not a Null',
    };
    const updatedDoc = this.db.updateDocument(path, expected);
    GSUnit.assertEquals(path, updatedDoc.path);
    GSUnit.assertObjectEquals(expected, updatedDoc.obj);
  }

  Test_Update_Document_Overwrite(): void {
    const original = {
      'number value': 10,
      'string value 이': 'The fox jumps over the lazy dog 름',
    };
    const path = 'Test Collection/Updatable Document Overwrite';
    this.db.createDocument(path, original);
    const expected = { 'number value': 42 };
    const updatedDoc = this.db.updateDocument(path, expected, false);
    GSUnit.assertEquals(path, updatedDoc.path);
    GSUnit.assertObjectEquals(expected, updatedDoc.obj);
  }

  Test_Update_Document_Mask(): void {
    const expected = {
      'number value': 1234567890,
      'string value 이': 'The fox jumps over the lazy dog 름',
    };
    const path = 'Test Collection/Updatable Document Mask';
    this.db.createDocument(path, expected);
    const updater = { 'string value 이': 'The new wave `~' };
    const updatedDoc = this.db.updateDocument(path, updater, true);
    Object.assign(expected, updater);
    GSUnit.assertEquals(path, updatedDoc.path);
    GSUnit.assertObjectEquals(expected, updatedDoc.obj);
  }

  Test_Update_Document_Mask_Array(): void {
    const expected: { [key: string]: string } = {
      field1: 'value1',
      field2: 'value2',
      field3: 'value3',
    };
    const path = 'Test Collection/Updatable Document MaskArray';
    this.db.createDocument(path, expected);
    const updater: { [key: string]: string } = { field2: 'new value2' };
    const updaterMask = ['field1', 'field2'];
    const updatedDoc = this.db.updateDocument(path, updater, updaterMask);
    for (const field of updaterMask) {
      if (field in updater) {
        expected[field] = updater[field];
      } else {
        delete expected[field];
      }
    }
    GSUnit.assertEquals(path, updatedDoc.path);
    GSUnit.assertObjectEquals(expected, updatedDoc.obj);
  }

  Test_Update_Document_Overwrite_Missing(): void {
    const path = 'Test Collection/Missing Document Overwrite';
    const expected = { 'boolean value': false };
    const updatedDoc = this.db.updateDocument(path, expected, false);
    GSUnit.assertEquals(path, updatedDoc.path);
    GSUnit.assertObjectEquals(expected, updatedDoc.obj);
  }

  Test_Update_Document_Mask_Missing(): void {
    const path = 'Test Collection/Missing Document Mask';
    const expected = { 'boolean value': true };
    const updatedDoc = this.db.updateDocument(path, expected, true);
    GSUnit.assertEquals(path, updatedDoc.path);
    GSUnit.assertObjectEquals(expected, updatedDoc.obj);
  }

  Test_Get_Document(): void {
    const path = 'Test Collection/New Document !@#$%^&*(),.<>?;\':"[]{}|-=_+áéíóúæÆÑ';
    const doc = this.db.getDocument(path);
    GSUnit.assertEquals(path, doc.path);
    GSUnit.assertObjectEquals(this.expected_, doc.obj);
  }

  Test_Get_Document_Missing(): void {
    const path = 'Test Collection/Missing Document';
    try {
      this.db.getDocument(path);
      GSUnit.fail('Missing document without error');
    } catch (e) {
      if (e.message !== `Document "${this.db.basePath}${path}" not found.`) {
        throw e;
      }
    }
  }

  Test_Get_Documents(): void {
    const path = 'Test Collection';
    const docs = this.db.getDocuments(path);
    GSUnit.assertEquals(8, docs.length);
    const doc = docs.find((doc) => doc.name!.endsWith('/New Document !@#$%^&*(),.<>?;\':"[]{}|-=_+áéíóúæÆÑ'));
    GSUnit.assertNotUndefined(doc);
    GSUnit.assertObjectEquals(this.expected_, doc!.obj);
  }

  Test_Get_Documents_By_ID(): void {
    const path = 'Test Collection';
    const ids = [
      'New Document',
      'Updatable Document Default',
      'Updatable Document Overwrite',
      'Updatable Document Mask',
      'Missing Document',
    ];
    const docs = this.db.getDocuments(path, ids);
    GSUnit.assertEquals(ids.length - 1, docs.length);
  }

  Test_Get_Documents_By_ID_Missing(): void {
    const path = 'Missing Collection';
    const ids = [
      'New Document',
      'Updatable Document Default',
      'Updatable Document Overwrite',
      'Updatable Document Mask',
      'Missing Document',
    ];
    const docs = this.db.getDocuments(path, ids);
    GSUnit.assertEquals(0, docs.length);
  }

  Test_Get_Documents_By_ID_Empty(): void {
    const path = 'Test Collection';
    const ids: string[] = [];
    const docs = this.db.getDocuments(path, ids);
    GSUnit.assertEquals(0, docs.length);
  }

  Test_Get_Document_IDs(): void {
    const path = 'Test Collection';
    const docs = this.db.getDocumentIds(path);
    GSUnit.assertEquals(8, docs.length);
  }

  Test_Get_Document_IDs_Missing(): void {
    const path = 'Missing Collection';
    const docs = this.db.getDocumentIds(path);
    GSUnit.assertEquals(0, docs.length);
  }

  Test_Query_All(): void {
    const path = 'Test Collection';
    const expected = this.db.getDocuments(path);
    expected.forEach((doc) => {
      delete doc.readTime;
    });
    const docs = this.db.query(path).Execute();
    docs.forEach((doc) => {
      delete doc.readTime;
    });
    GSUnit.assertArrayEquals(expected, docs);
  }

  Test_Query_Select_Name(): void {
    const path = 'Test Collection';
    const docs = this.db.query(path).Select().Execute();
    GSUnit.assertEquals(8, docs.length);
  }

  Test_Query_Select_Name_Number(): void {
    const path = 'Test Collection';
    const docs = this.db.query(path).Select().Select('number value').Execute();
    GSUnit.assertEquals(8, docs.length);
  }

  Test_Query_Select_String(): void {
    const path = 'Test Collection';
    const docs = this.db.query(path).Select('string value 이').Execute();
    GSUnit.assertEquals(8, docs.length);
  }

  Test_Query_Where_EqEq_String(): void {
    const expected = ['New Document !@#$%^&*(),.<>?;\':"[]{}|-=_+áéíóúæÆÑ'];
    const path = 'Test Collection';
    const docs = this.db.query(path).Where('string value 이', '==', 'The fox jumps over the lazy dog 름').Execute();
    GSUnit.assertEquals(1, docs.length);
    GSUnit.assertArrayEqualsIgnoringOrder(
      expected.map((p) => `${path}/${p}`),
      docs.map((doc) => doc.path)
    );
  }

  Test_Query_Where_EqEqEq_String(): void {
    const expected = ['New Document !@#$%^&*(),.<>?;\':"[]{}|-=_+áéíóúæÆÑ'];
    const path = 'Test Collection';
    const docs = this.db.query(path).Where('string value 이', '===', 'The fox jumps over the lazy dog 름').Execute();
    GSUnit.assertEquals(1, docs.length);
    GSUnit.assertArrayEqualsIgnoringOrder(
      expected.map((p) => `${path}/${p}`),
      docs.map((doc) => doc.path)
    );
  }

  Test_Query_Where_Eq_Number(): void {
    const expected = ['New Document !@#$%^&*(),.<>?;\':"[]{}|-=_+áéíóúæÆÑ'];
    const path = 'Test Collection';
    const docs = this.db.query(path).Where('number value', '==', 100).Execute();
    GSUnit.assertEquals(1, docs.length);
    GSUnit.assertArrayEqualsIgnoringOrder(
      expected.map((p) => `${path}/${p}`),
      docs.map((doc) => doc.path)
    );
  }

  Test_Query_Where_Lt_Number(): void {
    const expected = ['Updatable Document Overwrite'];
    const path = 'Test Collection';
    const docs = this.db.query(path).Where('number value', '<', 100).Execute();
    GSUnit.assertEquals(1, docs.length);
    GSUnit.assertArrayEqualsIgnoringOrder(
      expected.map((p) => `${path}/${p}`),
      docs.map((doc) => doc.path)
    );
  }

  Test_Query_Where_Lte_Number(): void {
    const expected = ['New Document !@#$%^&*(),.<>?;\':"[]{}|-=_+áéíóúæÆÑ', 'Updatable Document Overwrite'];
    const path = 'Test Collection';
    const docs = this.db.query(path).Where('number value', '<=', 100).Execute();
    GSUnit.assertEquals(2, docs.length);
    GSUnit.assertArrayEqualsIgnoringOrder(
      expected.map((p) => `${path}/${p}`),
      docs.map((doc) => doc.path)
    );
  }

  Test_Query_Where_Gt_Number(): void {
    const expected = ['Updatable Document Mask'];
    const path = 'Test Collection';
    const docs = this.db.query(path).Where('number value', '>', 100).Execute();
    GSUnit.assertEquals(1, docs.length);
    GSUnit.assertArrayEqualsIgnoringOrder(
      expected.map((p) => `${path}/${p}`),
      docs.map((doc) => doc.path)
    );
  }

  Test_Query_Where_Gte_Number(): void {
    const expected = ['New Document !@#$%^&*(),.<>?;\':"[]{}|-=_+áéíóúæÆÑ', 'Updatable Document Mask'];
    const path = 'Test Collection';
    const docs = this.db.query(path).Where('number value', '>=', 100).Execute();
    GSUnit.assertEquals(2, docs.length);
    GSUnit.assertArrayEqualsIgnoringOrder(
      expected.map((p) => `${path}/${p}`),
      docs.map((doc) => doc.path)
    );
  }

  Test_Query_Where_Contains(): void {
    const expected = ['New Document !@#$%^&*(),.<>?;\':"[]{}|-=_+áéíóúæÆÑ'];
    const path = 'Test Collection';
    const docs = this.db.query(path).Where('array value', 'contains', 42).Execute();
    GSUnit.assertEquals(1, docs.length);
    GSUnit.assertArrayEqualsIgnoringOrder(
      expected.map((p) => `${path}/${p}`),
      docs.map((doc) => doc.path)
    );
  }

  Test_Query_Where_Contains_Any(): void {
    const expected = ['New Document !@#$%^&*(),.<>?;\':"[]{}|-=_+áéíóúæÆÑ'];
    const path = 'Test Collection';
    const docs = this.db.query(path).Where('array value', 'containsany', [false, 0, 42, 'bar']).Execute();
    GSUnit.assertEquals(1, docs.length);
    GSUnit.assertArrayEqualsIgnoringOrder(
      expected.map((p) => `${path}/${p}`),
      docs.map((doc) => doc.path)
    );
  }

  Test_Query_Where_In(): void {
    const expected = ['New Document !@#$%^&*(),.<>?;\':"[]{}|-=_+áéíóúæÆÑ', 'Updatable Document Overwrite'];
    const path = 'Test Collection';
    const docs = this.db.query(path).Where('number value', 'in', [0, 100, 42]).Execute();
    GSUnit.assertEquals(2, docs.length);
    GSUnit.assertArrayEqualsIgnoringOrder(
      expected.map((p) => `${path}/${p}`),
      docs.map((doc) => doc.path)
    );
  }

  Test_Query_Where_Nan(): void {
    // Unable to store NaN values to Firestore, so no results
    const path = 'Test Collection';
    const docs = this.db.query(path).Where('number value', NaN).Execute();
    GSUnit.assertEquals(0, docs.length);
  }

  Test_Query_Where_Null(): void {
    const expected = ['New Document !@#$%^&*(),.<>?;\':"[]{}|-=_+áéíóúæÆÑ'];
    const path = 'Test Collection';
    const docs = this.db.query(path).Where('null value', null).Execute();
    GSUnit.assertEquals(1, docs.length);
    GSUnit.assertArrayEqualsIgnoringOrder(
      expected.map((p) => `${path}/${p}`),
      docs.map((doc) => doc.path)
    );
    GSUnit.assertObjectEquals(this.expected_, docs[0].obj);
  }

  Test_Query_OrderBy_Number(): void {
    const expected = [
      'Updatable Document Overwrite',
      'New Document !@#$%^&*(),.<>?;\':"[]{}|-=_+áéíóúæÆÑ',
      'Updatable Document Mask',
    ];
    const path = 'Test Collection';
    const docs = this.db.query(path).Select().OrderBy('number value').Execute();
    GSUnit.assertArrayEquals(expected, Util_.stripBasePath(path, docs));
  }

  Test_Query_OrderBy_Number_ASC(): void {
    const expected = [
      'Updatable Document Overwrite',
      'New Document !@#$%^&*(),.<>?;\':"[]{}|-=_+áéíóúæÆÑ',
      'Updatable Document Mask',
    ];
    const path = 'Test Collection';
    const docs = this.db.query(path).Select().OrderBy('number value', 'asc').Execute();
    GSUnit.assertArrayEquals(expected, Util_.stripBasePath(path, docs));
  }

  Test_Query_OrderBy_Number_DESC(): void {
    const expected = [
      'Updatable Document Mask',
      'New Document !@#$%^&*(),.<>?;\':"[]{}|-=_+áéíóúæÆÑ',
      'Updatable Document Overwrite',
    ];
    const path = 'Test Collection';
    const docs = this.db.query(path).Select().OrderBy('number value', 'desc').Execute();
    GSUnit.assertArrayEquals(expected, Util_.stripBasePath(path, docs));
  }

  Test_Query_Offset(): void {
    const path = 'Test Collection';
    const docs = this.db.query(path).Offset(2).Execute();
    GSUnit.assertEquals(6, docs.length);
  }

  Test_Query_Limit(): void {
    const path = 'Test Collection';
    const docs = this.db.query(path).Limit(2).Execute();
    GSUnit.assertEquals(2, docs.length);
  }

  Test_Query_Range(): void {
    const path = 'Test Collection';
    const docs = this.db.query(path).Range(2, 5).Execute();
    GSUnit.assertEquals(5 - 2, docs.length);
  }

  // === NEW FEATURE TESTS ===

  Test_WriteBatch_Create(): void {
    const batch = this.db.batch();
    GSUnit.assertNotUndefined(batch);
    GSUnit.assertEquals(0, batch.size());

    // Test batch operations
    batch.create('Test Collection/Batch Test 1', { name: 'Test 1', value: 10 });
    batch.set('Test Collection/Batch Test 2', { name: 'Test 2', value: 20 });
    batch.update('Test Collection/New Document', { 'batch test': true }, true);

    GSUnit.assertEquals(3, batch.size());

    const results = batch.commit();
    GSUnit.assertEquals(3, results.length);

    // Verify documents were created
    const doc1 = this.db.getDocument('Test Collection/Batch Test 1');
    GSUnit.assertEquals('Test 1', doc1.obj.name);
    GSUnit.assertEquals(10, doc1.obj.value);
  }

  Test_WriteBatch_Transform(): void {
    // Create initial document
    this.db.createDocument('Test Collection/Transform Test', {
      counter: 5,
      tags: ['initial'],
      timestamp: null
    });

    const batch = this.db.batch();
    batch.transform('Test Collection/Transform Test', {
      counter: { increment: 3 },
      tags: { arrayUnion: ['new-tag'] },
      timestamp: 'serverTimestamp'
    });

    const results = batch.commit();
    GSUnit.assertEquals(1, results.length);

    const doc = this.db.getDocument('Test Collection/Transform Test');
    GSUnit.assertEquals(8, doc.obj.counter);
    GSUnit.assertTrue(doc.obj.tags.includes('initial'));
    GSUnit.assertTrue(doc.obj.tags.includes('new-tag'));
    GSUnit.assertNotNull(doc.obj.timestamp);
  }

  Test_Transaction_Basic(): void {
    // Create test document
    this.db.createDocument('Test Collection/Transaction Test', { balance: 100 });

    const result = this.db.runTransaction((transaction) => {
      const doc = transaction.get('Test Collection/Transaction Test');
      const currentBalance = doc.obj.balance;

      if (currentBalance >= 50) {
        transaction.update('Test Collection/Transaction Test', { balance: currentBalance - 50 });
        return { success: true, newBalance: currentBalance - 50 };
      } else {
        throw new Error('Insufficient balance');
      }
    });

    GSUnit.assertEquals(true, result.success);
    GSUnit.assertEquals(50, result.newBalance);

    // Verify the document was updated
    const updatedDoc = this.db.getDocument('Test Collection/Transaction Test');
    GSUnit.assertEquals(50, updatedDoc.obj.balance);
  }

  Test_Transaction_Manual(): void {
    this.db.createDocument('Test Collection/Manual Transaction Test', { value: 42 });

    const transaction = this.db.transaction();
    transaction.begin();

    const doc = transaction.get('Test Collection/Manual Transaction Test');
    GSUnit.assertEquals(42, doc.obj.value);

    transaction.set('Test Collection/Manual Transaction Test', { value: 84, updated: true });

    const results = transaction.commit();
    GSUnit.assertEquals(1, results.length);

    const finalDoc = this.db.getDocument('Test Collection/Manual Transaction Test');
    GSUnit.assertEquals(84, finalDoc.obj.value);
    GSUnit.assertEquals(true, finalDoc.obj.updated);
  }

  Test_Query_New_Operators(): void {
    // Test != operator
    const path = 'Test Collection';
    const notEqualDocs = this.db.query(path).Where('number value', '!=', 100).Execute();
    GSUnit.assertTrue(notEqualDocs.length >= 2); // Should find documents with values other than 100

    // Test not-in operator
    const notInDocs = this.db.query(path).Where('number value', 'not-in', [100, 42]).Execute();
    GSUnit.assertTrue(notInDocs.length >= 1); // Should find documents not having these values
  }

  Test_Query_OR_Filters(): void {
    const path = 'Test Collection';

    const filter1 = Query.createFilter('number value', '==', 100);
    const filter2 = Query.createFilter('number value', '==', 42);

    const orDocs = this.db.query(path).WhereOr([filter1, filter2]).Execute();
    GSUnit.assertTrue(orDocs.length >= 2); // Should find documents with either value
  }

  Test_Query_Cursors(): void {
    const path = 'Test Collection';

    // Get first batch ordered by number value
    const firstBatch = this.db.query(path)
      .OrderBy('number value', 'asc')
      .Limit(2)
      .Execute();

    GSUnit.assertEquals(2, firstBatch.length);

    // Get next batch using cursor
    const lastDocValue = firstBatch[firstBatch.length - 1].obj['number value'];
    const secondBatch = this.db.query(path)
      .OrderBy('number value', 'asc')
      .StartAfter(lastDocValue)
      .Limit(2)
      .Execute();

    GSUnit.assertTrue(secondBatch.length >= 1);
    // Verify the second batch starts after the first
    if (secondBatch.length > 0) {
      GSUnit.assertTrue(secondBatch[0].obj['number value'] > lastDocValue);
    }
  }

  Test_CollectionGroup_Query(): void {
    // Create test data in different parent paths
    this.db.createDocument('Users/user1/Posts/post1', { title: 'User 1 Post', public: true });
    this.db.createDocument('Users/user2/Posts/post2', { title: 'User 2 Post', public: true });
    this.db.createDocument('Admin/system/Posts/system_post', { title: 'System Post', public: false });

    // Query all Posts collections across different parents
    const allPosts = this.db.collectionGroup('Posts')
      .Where('public', '==', true)
      .Execute();

    GSUnit.assertTrue(allPosts.length >= 2);

    // Verify we got posts from different users
    const titles = allPosts.map(doc => doc.obj.title);
    GSUnit.assertTrue(titles.includes('User 1 Post'));
    GSUnit.assertTrue(titles.includes('User 2 Post'));
    GSUnit.assertFalse(titles.includes('System Post')); // This one is not public
  }

  Test_MultiCollection_Query(): void {
    // Create test data
    this.db.createDocument('Products/product1', { name: 'Product 1', featured: true });
    this.db.createDocument('Services/service1', { name: 'Service 1', featured: true });
    this.db.createDocument('Categories/category1', { name: 'Category 1', featured: false });

    // Query multiple collections
    const featured = this.db.queryMultipleCollections(['Products', 'Services', 'Categories'])
      .Where('featured', '==', true)
      .Execute();

    GSUnit.assertEquals(2, featured.length);

    const names = featured.map(doc => doc.obj.name);
    GSUnit.assertTrue(names.includes('Product 1'));
    GSUnit.assertTrue(names.includes('Service 1'));
    GSUnit.assertFalse(names.includes('Category 1'));
  }

  Test_Query_Dynamic_Collections(): void {
    const query = this.db.query('Test Collection');

    // Test adding collections dynamically
    query.addCollections(['Products', 'Services']);
    const collections = query.getCollections();
    GSUnit.assertTrue(collections.includes('Test Collection'));
    GSUnit.assertTrue(collections.includes('Products'));
    GSUnit.assertTrue(collections.includes('Services'));
    GSUnit.assertEquals(3, collections.length);

    // Test removing collections
    query.removeCollections('Services');
    const afterRemoval = query.getCollections();
    GSUnit.assertFalse(afterRemoval.includes('Services'));
    GSUnit.assertEquals(2, afterRemoval.length);

    // Test adding collection groups
    query.addCollectionGroups(['Reviews']);
    const withGroups = query.getCollections();
    GSUnit.assertTrue(withGroups.includes('Reviews'));
    GSUnit.assertEquals(3, withGroups.length);
  }

  Test_AggregateQuery_Basic(): void {
    // Test count aggregation
    const countResult = this.db.aggregateQuery('Test Collection')
      .count('total_docs')
      .get();

    GSUnit.assertNotUndefined(countResult.total_docs);
    GSUnit.assertTrue(countResult.total_docs > 0);

    // Test multiple aggregations
    const stats = this.db.aggregateQuery('Test Collection')
      .count('doc_count')
      .sum('number value', 'total_sum')
      .avg('number value', 'average_value')
      .get();

    GSUnit.assertNotUndefined(stats.doc_count);
    GSUnit.assertNotUndefined(stats.total_sum);
    GSUnit.assertNotUndefined(stats.average_value);
    GSUnit.assertTrue(stats.doc_count > 0);
  }

  Test_AggregateQuery_FromQuery(): void {
    const baseQuery = this.db.query('Test Collection')
      .Where('number value', '>', 50);

    const aggregateResult = this.db.aggregateFromQuery(baseQuery)
      .count('filtered_count')
      .avg('number value', 'filtered_avg')
      .get();

    GSUnit.assertNotUndefined(aggregateResult.filtered_count);
    GSUnit.assertNotUndefined(aggregateResult.filtered_avg);

    // The filtered average should be higher than 50 since we filtered for values > 50
    if (aggregateResult.filtered_count > 0) {
      GSUnit.assertTrue(aggregateResult.filtered_avg > 50);
    }
  }

  Test_AggregateQuery_CollectionGroup(): void {
    // Create some test data for aggregation
    this.db.createDocument('Metrics/day1/Events/event1', { value: 10, type: 'click' });
    this.db.createDocument('Metrics/day2/Events/event2', { value: 20, type: 'click' });
    this.db.createDocument('Metrics/day3/Events/event3', { value: 15, type: 'view' });

    const eventStats = this.db.aggregateCollectionGroup('Events')
      .count('total_events')
      .sum('value', 'total_value')
      .avg('value', 'avg_value')
      .get();

    GSUnit.assertTrue(eventStats.total_events >= 3);
    GSUnit.assertTrue(eventStats.total_value >= 45); // 10 + 20 + 15
    GSUnit.assertTrue(eventStats.avg_value >= 10 && eventStats.avg_value <= 20);
  }

  Test_BatchWrite_Direct(): void {
    const writes: FirestoreAPI.Write[] = [
      {
        update: {
          name: this.db.basePath + 'Test Collection/Direct Batch 1',
          fields: {
            name: { stringValue: 'Direct Test 1' },
            value: { integerValue: '100' }
          }
        }
      },
      {
        update: {
          name: this.db.basePath + 'Test Collection/Direct Batch 2',
          fields: {
            name: { stringValue: 'Direct Test 2' },
            value: { integerValue: '200' }
          }
        }
      }
    ];

    const results = this.db.batchWrite(writes);
    GSUnit.assertEquals(2, results.length);

    // Verify documents were created
    const doc1 = this.db.getDocument('Test Collection/Direct Batch 1');
    const doc2 = this.db.getDocument('Test Collection/Direct Batch 2');
    GSUnit.assertEquals('Direct Test 1', doc1.obj.name);
    GSUnit.assertEquals('Direct Test 2', doc2.obj.name);
  }

  Test_Delete_Documents(): void {
    const collection = 'Test Collection';
    const docs = this.db.getDocumentIds(collection).map((path) => this.db.deleteDocument(collection + '/' + path));
    docs.forEach((doc) => GSUnit.assertObjectEquals({}, doc));

    // Clean up additional test collections
    const additionalCollections = ['Users', 'Products', 'Services', 'Categories', 'Metrics'];
    for (const col of additionalCollections) {
      try {
        const docIds = this.db.getDocumentIds(col);
        docIds.forEach(docId => {
          this.db.deleteDocument(`${col}/${docId}`);
        });
      } catch (e) {
        // Collection might not exist, ignore
      }
    }
  }

  Test_Delete_Document_Missing() {
    const path = 'Test Collection/Missing Document';
    const noDoc = this.db.deleteDocument(path);
    GSUnit.assertObjectEquals({}, noDoc);
  }
}

function RunTests_(cacheSeconds: number): Shield {
  const scriptProps = PropertiesService.getUserProperties().getProperties();
  const tests = new Tests(scriptProps['email'], scriptProps['key'], scriptProps['project'], 'v1');
  const { pass, fail } = tests;
  for (const [func, err] of fail) {
    console.log(`Test Failed: ${func} (${err.message})\n${err.stack}`);
  }
  console.log(`Completed ${pass.length + fail.size} Tests.`);
  return {
    schemaVersion: 1,
    label: 'tests',
    message: `✔ ${pass.length}, ✘ ${Object.keys(fail).length}`,
    color: Object.keys(fail).length ? 'red' : 'green',
    cacheSeconds: cacheSeconds, // Always cache for 1 hour
  };
}

function cacheResults_(cachedBadge: boolean): string {
  /* Script owner should set up a trigger for this function to cache the test results.
   * The badge fetching these Test Results (on README) is set to cache the image after 1 hour.
   * GitHub creates anonymized URLs which timeout after 3 seconds,
   * which is longer than the time it takes to execute all the tests.
   */
  const maxCache = 3600;
  const results = JSON.stringify(RunTests_(maxCache));
  CacheService.getUserCache()!.put('Test Results', results, maxCache);
  // Send the min cache allowed @see {@link https://shields.io/endpoint ShieldsIO Endpoint}
  return results.replace(`"cacheSeconds":${maxCache}`, `"cacheSeconds":${cachedBadge ? maxCache : 300}`);
}

/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
function clearCache(): void {
  /** Allow user to clear Cached Results **/
  const scriptProps = PropertiesService.getUserProperties().getProperties();
  new Tests(scriptProps['email'], scriptProps['key'], scriptProps['project'], 'v1', true);
  CacheService.getUserCache()!.remove('Test Results');
}

/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
function doGet(evt: GoogleAppsScript.Events.AppsScriptHttpRequestEvent): GoogleAppsScript.Content.TextOutput {
  // Sending /exec?nocache when calling to ignore the cache check
  const useCache = evt.queryString !== 'nocache';
  const results = (useCache && CacheService.getUserCache()!.get('Test Results')) || cacheResults_(useCache);
  return ContentService.createTextOutput(results);
}
