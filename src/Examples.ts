/**
 * Example usage of the new Firestore features.
 * This file demonstrates how to use transactions, batch writes, and aggregate queries.
 */

// Example: Using WriteBatch
function exampleBatchWrite() {
  const firestore = getFirestore('user@example.com', 'private-key', 'your-project-id');

  // Create a batch
  const batch = firestore.batch();

  // Add operations to batch
  batch.set('users/user1', { name: 'Alice', age: 30 });
  batch.set('users/user2', { name: 'Bob', age: 25 });
  batch.update('users/user3', { lastLogin: new Date() });
  batch.delete('users/oldUser');

  // Commit all operations
  const results = batch.commit();
  console.log(`Committed ${results.length} operations`);
}

// Example: Using Transactions with automatic retry
function exampleTransaction() {
  const firestore = getFirestore('user@example.com', 'private-key', 'your-project-id');

  const result = firestore.runTransaction((transaction) => {
    // Read operations first
    const userDoc = transaction.get('users/alice');
    const currentBalance = userDoc.obj.balance || 0;

    if (currentBalance >= 50) {
      // Write operations
      transaction.update('users/alice', { balance: currentBalance - 50 });
      transaction.create('transactions/tx1', {
        from: 'alice',
        amount: 50,
        timestamp: new Date()
      });

      return { success: true, newBalance: currentBalance - 50 };
    } else {
      throw new Error('Insufficient balance');
    }
  });

  console.log('Transaction result:', result);
}

// Example: Manual transaction control
function exampleManualTransaction() {
  const firestore = getFirestore('user@example.com', 'private-key', 'your-project-id');

  const transaction = firestore.transaction();

  try {
    transaction.begin();

    // Perform operations
    const doc = transaction.get('users/bob');
    transaction.set('users/bob', { ...doc.obj, lastAccess: new Date() });

    const results = transaction.commit();
    console.log('Manual transaction committed:', results);
  } catch (error) {
    transaction.rollback();
    console.error('Transaction failed:', error);
  }
}

// Example: Advanced queries with OR filters
function exampleAdvancedQueries() {
  const firestore = getFirestore('user@example.com', 'private-key', 'your-project-id');

  // Create OR filter
  const ageFilter = Query.createFilter('age', '>', 18);
  const statusFilter = Query.createFilter('status', '==', 'premium');

  // Query with OR condition
  const users = firestore.query('users')
    .Where('active', '==', true)
    .WhereOr([ageFilter, statusFilter])
    .OrderBy('name', 'asc')
    .StartAfter('Alice')
    .Limit(10)
    .Execute();

  console.log(`Found ${users.length} users`);
}

// Example: Pagination with cursors
function examplePagination() {
  const firestore = getFirestore('user@example.com', 'private-key', 'your-project-id');

  // First page
  const firstPage = firestore.query('posts')
    .OrderBy('timestamp', 'desc')
    .Limit(10)
    .Execute();

  // Second page using cursor
  if (firstPage.length === 10) {
    const lastDoc = firstPage[firstPage.length - 1];
    const secondPage = firestore.query('posts')
      .OrderBy('timestamp', 'desc')
      .StartAfter(lastDoc.obj.timestamp)
      .Limit(10)
      .Execute();

    console.log(`Second page has ${secondPage.length} posts`);
  }
}

// Example: Aggregate queries
function exampleAggregateQueries() {
  const firestore = getFirestore('user@example.com', 'private-key', 'your-project-id');

  // Simple count
  const userCount = firestore.aggregateQuery('users')
    .count()
    .get();

  console.log(`Total users: ${userCount.count}`);

  // Multiple aggregations
  const stats = firestore.aggregateQuery('orders')
    .count('total_orders')
    .sum('amount', 'total_revenue')
    .avg('amount', 'avg_order_value')
    .get();

  console.log('Order statistics:', stats);
}

// Example: Aggregate from existing query
function exampleConditionalAggregates() {
  const firestore = getFirestore('user@example.com', 'private-key', 'your-project-id');

  // Create base query
  const recentOrdersQuery = firestore.query('orders')
    .Where('timestamp', '>', new Date('2024-01-01'))
    .Where('status', '==', 'completed');

  // Get aggregation from query
  const recentStats = firestore.aggregateFromQuery(recentOrdersQuery)
    .count('completed_orders')
    .sum('amount', 'revenue_2024')
    .get();

  console.log('Recent order stats:', recentStats);
}

// Example: Field transforms in batch operations
function exampleFieldTransforms() {
  const firestore = getFirestore('user@example.com', 'private-key', 'your-project-id');

  const batch = firestore.batch();

  // Use field transforms
  batch.transform('counters/pageViews', {
    count: { increment: 1 },
    lastUpdated: 'serverTimestamp',
    tags: { arrayUnion: ['new-feature'] },
    oldTags: { arrayRemove: ['deprecated'] }
  });

  batch.commit();
  console.log('Field transforms applied');
}

// Example: Complex document operations
function exampleComplexOperations() {
  const firestore = getFirestore('user@example.com', 'private-key', 'your-project-id');

  // Using != and not-in operators
  const activeUsers = firestore.query('users')
    .Where('status', '!=', 'deleted')
    .Where('role', 'not-in', ['banned', 'suspended'])
    .Execute();

  console.log(`Found ${activeUsers.length} active users`);

  // Complex nested field queries
  const premiumPosts = firestore.query('posts')
    .Where('author.tier', '==', 'premium')
    .Where('metadata.featured', '==', true)
    .OrderBy('createdAt', 'desc')
    .Execute();

  console.log(`Found ${premiumPosts.length} premium posts`);
}

// Example: Collection Group Queries
function exampleCollectionGroupQueries() {
  const firestore = getFirestore('user@example.com', 'private-key', 'your-project-id');

  // Query all "messages" collections across all chat rooms
  // This will find messages in:
  // - chatrooms/room1/messages/msg1
  // - chatrooms/room2/messages/msg2
  // - users/user1/messages/msg3
  // - etc.
  const allMessages = firestore.collectionGroup('messages')
    .Where('timestamp', '>', new Date('2024-01-01'))
    .OrderBy('timestamp', 'desc')
    .Limit(50)
    .Execute();

  console.log(`Found ${allMessages.length} messages across all collections`);

  // Query all "comments" collections with advanced filtering
  const recentComments = firestore.collectionGroup('comments')
    .Where('approved', '==', true)
    .Where('score', '>', 5)
    .OrderBy('createdAt', 'desc')
    .Execute();

  console.log(`Found ${recentComments.length} approved comments`);
}

// Example: Collection Group with OR filters
function exampleCollectionGroupWithComplexFilters() {
  const firestore = getFirestore('user@example.com', 'private-key', 'your-project-id');

  // Create filters for OR condition
  const urgentFilter = Query.createFilter('priority', '==', 'urgent');
  const highScoreFilter = Query.createFilter('score', '>', 90);

  // Query all "tasks" collections across all projects/users
  const importantTasks = firestore.collectionGroup('tasks')
    .Where('completed', '!=', true)
    .WhereOr([urgentFilter, highScoreFilter])
    .OrderBy('dueDate', 'asc')
    .Execute();

  console.log(`Found ${importantTasks.length} important tasks across all projects`);
}

// Example: Collection Group Aggregations
function exampleCollectionGroupAggregations() {
  const firestore = getFirestore('user@example.com', 'private-key', 'your-project-id');

  // Count all orders across all users
  const orderStats = firestore.aggregateCollectionGroup('orders')
    .count('total_orders')
    .sum('amount', 'total_revenue')
    .avg('amount', 'avg_order_value')
    .get();

  console.log('Global order statistics:', orderStats);

  // Count all reviews with rating > 4
  const reviewQuery = firestore.collectionGroup('reviews')
    .Where('rating', '>', 4);

  const goodReviewStats = firestore.aggregateFromQuery(reviewQuery)
    .count('good_reviews')
    .avg('rating', 'avg_good_rating')
    .get();

  console.log('Good review statistics:', goodReviewStats);
}

// Example: Mixed Collection and Collection Group Queries
function exampleMixedQueries() {
  const firestore = getFirestore('user@example.com', 'private-key', 'your-project-id');

  // Regular collection query for a specific user's posts
  const userPosts = firestore.query('users/alice/posts')
    .Where('published', '==', true)
    .Execute();

  console.log(`Alice has ${userPosts.length} published posts`);

  // Collection group query for all posts across all users
  const allPublishedPosts = firestore.collectionGroup('posts')
    .Where('published', '==', true)
    .Where('createdAt', '>', new Date('2024-01-01'))
    .Execute();

  console.log(`Found ${allPublishedPosts.length} published posts across all users this year`);

  // Compare user-specific vs global statistics
  const userPostCount = firestore.aggregateQuery('users/alice/posts')
    .count('alice_posts')
    .get();

  const globalPostCount = firestore.aggregateCollectionGroup('posts')
    .count('all_posts')
    .get();

  console.log(`Alice: ${userPostCount.alice_posts} posts, Global: ${globalPostCount.all_posts} posts`);
}

// Example: Real-world use case - Chat application
function exampleChatApplication() {
  const firestore = getFirestore('user@example.com', 'private-key', 'your-project-id');

  // Find all unread messages for a user across all conversations
  const unreadMessages = firestore.collectionGroup('messages')
    .Where('readBy', 'array-contains', 'current-user-id')
    .Where('timestamp', '>', new Date('2024-01-01'))
    .OrderBy('timestamp', 'desc')
    .Execute();

  // Get conversation statistics
  const messageStats = firestore.aggregateCollectionGroup('messages')
    .count('total_messages')
    .get();

  // Find recent active conversations
  const activeConversations = firestore.collectionGroup('messages')
    .Where('timestamp', '>', new Date(Date.now() - 24 * 60 * 60 * 1000)) // Last 24 hours
    .Select('conversationId') // Only get conversation IDs
    .Execute();

  // Get unique conversation IDs
  const uniqueConversations = [...new Set(activeConversations.map(msg => msg.obj.conversationId))];

  console.log(`Unread messages: ${unreadMessages.length}`);
  console.log(`Total messages in system: ${messageStats.total_messages}`);
  console.log(`Active conversations (24h): ${uniqueConversations.length}`);
}

// Example: Multi-Collection Queries
function exampleMultiCollectionQueries() {
  const firestore = getFirestore('user@example.com', 'private-key', 'your-project-id');

  // Query multiple specific collections in one query
  const multipleCollections = firestore.queryMultipleCollections([
    'users',
    'products',
    'categories'
  ])
    .Where('featured', '==', true)
    .OrderBy('priority', 'desc')
    .Execute();

  console.log(`Found ${multipleCollections.length} featured items across users, products, and categories`);

  // Query multiple collection groups
  const multipleGroups = firestore.queryMultipleCollectionGroups([
    'reviews',
    'ratings',
    'comments'
  ])
    .Where('approved', '==', true)
    .Where('timestamp', '>', new Date('2024-01-01'))
    .Execute();

  console.log(`Found ${multipleGroups.length} approved content across all review systems`);
}

// Example: Dynamic Multi-Collection Queries
function exampleDynamicMultiCollectionQueries() {
  const firestore = getFirestore('user@example.com', 'private-key', 'your-project-id');

  // Start with one collection and dynamically add more
  const query = firestore.query('posts')
    .Where('published', '==', true);

  // Add more collections based on conditions
  query.addCollections(['articles', 'blogs'])
       .addCollectionGroups(['reviews']); // Add collection group

  // Remove a collection if needed
  query.removeCollections('blogs');

  // Check what collections are being queried
  console.log('Currently querying collections:', query.getCollections());

  const results = query.OrderBy('createdAt', 'desc')
                      .Limit(20)
                      .Execute();

  console.log(`Found ${results.length} published content items`);
}

// Example: Mixed Collection Types in Single Query
function exampleMixedCollectionTypes() {
  const firestore = getFirestore('user@example.com', 'private-key', 'your-project-id');

  // Combine regular collections and collection groups
  const mixedQuery = firestore.query('users')
    .addCollections(['products', 'services']) // Regular collections
    .addCollectionGroups(['reviews', 'ratings']); // Collection groups

  const results = mixedQuery
    .Where('active', '==', true)
    .Where('score', '>', 4)
    .Execute();

  console.log(`Mixed query found ${results.length} high-quality active items`);
}

// Example: Multi-Collection Aggregations
function exampleMultiCollectionAggregations() {
  const firestore = getFirestore('user@example.com', 'private-key', 'your-project-id');

  // Create a multi-collection query for aggregation
  const multiCollectionQuery = firestore.queryMultipleCollections([
    'orders',
    'subscriptions',
    'donations'
  ]).Where('status', '==', 'completed');

  // Aggregate across multiple collection types
  const revenueStats = firestore.aggregateFromQuery(multiCollectionQuery)
    .count('total_transactions')
    .sum('amount', 'total_revenue')
    .avg('amount', 'avg_transaction_value')
    .get();

  console.log('Revenue across all transaction types:', revenueStats);
}

// Example: Content Management System Use Case
function exampleContentManagementSystem() {
  const firestore = getFirestore('user@example.com', 'private-key', 'your-project-id');

  // Search across all content types for moderation
  const contentQuery = firestore.queryMultipleCollections([
    'posts',
    'comments',
    'reviews',
    'messages'
  ]);

  // Find flagged content across all types
  const flaggedContent = contentQuery
    .Where('flagged', '==', true)
    .Where('reviewStatus', '==', 'pending')
    .OrderBy('flaggedAt', 'desc')
    .Execute();

  console.log(`Found ${flaggedContent.length} flagged items requiring moderation`);

  // Get content statistics by type
  const contentStats = firestore.aggregateFromQuery(contentQuery)
    .count('total_content_items')
    .get();

  // Search across all user-generated content (collection groups)
  const userContentGroups = firestore.queryMultipleCollectionGroups([
    'posts',
    'comments',
    'uploads'
  ]);

  const recentUserContent = userContentGroups
    .Where('createdAt', '>', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) // Last week
    .Where('approved', '==', true)
    .Execute();

  console.log(`Content stats: ${contentStats.total_content_items} total items`);
  console.log(`Recent user content: ${recentUserContent.length} items this week`);
}

// Example: Advanced Multi-Collection Analytics
function exampleAdvancedMultiCollectionAnalytics() {
  const firestore = getFirestore('user@example.com', 'private-key', 'your-project-id');

  // Analytics across different event types
  const eventQuery = firestore.queryMultipleCollectionGroups([
    'pageViews',
    'clicks',
    'conversions',
    'errors'
  ]);

  // Recent events for real-time analytics
  const recentEvents = eventQuery
    .Where('timestamp', '>', new Date(Date.now() - 60 * 60 * 1000)) // Last hour
    .OrderBy('timestamp', 'desc')
    .Limit(1000)
    .Execute();

  // Event aggregations
  const eventStats = firestore.aggregateFromQuery(eventQuery.Where('timestamp', '>', new Date(Date.now() - 24 * 60 * 60 * 1000)))
    .count('total_events_24h')
    .get();

  // User behavior across multiple collection types
  const userActivityQuery = firestore.queryMultipleCollections([
    'sessions',
    'purchases',
    'support_tickets'
  ]);

  const activeUsers = userActivityQuery
    .Where('timestamp', '>', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) // Last 30 days
    .Select('userId') // Only get user IDs
    .Execute();

  // Get unique active user count
  const uniqueActiveUsers = [...new Set(activeUsers.map(doc => doc.obj.userId))];

  console.log(`Recent events: ${recentEvents.length} in last hour`);
  console.log(`24h event count: ${eventStats.total_events_24h}`);
  console.log(`Active users (30 days): ${uniqueActiveUsers.length}`);
}

// Example: E-commerce Multi-Collection Queries
function exampleEcommerceMultiCollection() {
  const firestore = getFirestore('user@example.com', 'private-key', 'your-project-id');

  // Search across all product-related collections
  const productQuery = firestore.queryMultipleCollections([
    'products',
    'variants',
    'bundles',
    'digital_products'
  ]);

  // Find products that need restocking
  const lowStockItems = productQuery
    .Where('inventory.quantity', '<=', 10)
    .Where('status', '==', 'active')
    .OrderBy('inventory.quantity', 'asc')
    .Execute();

  // Customer interaction data across all touchpoints
  const customerInteractionGroups = firestore.queryMultipleCollectionGroups([
    'reviews',
    'questions',
    'support_requests',
    'wish_list_items'
  ]);

  const customerFeedback = customerInteractionGroups
    .Where('customerId', '==', 'customer-123')
    .OrderBy('createdAt', 'desc')
    .Execute();

  // Sales data aggregation
  const salesQuery = firestore.queryMultipleCollections([
    'orders',
    'subscriptions',
    'gift_card_sales'
  ]).Where('status', '==', 'completed');

  const salesStats = firestore.aggregateFromQuery(salesQuery)
    .count('total_sales')
    .sum('total_amount', 'total_revenue')
    .avg('total_amount', 'avg_order_value')
    .get();

  console.log(`Low stock items: ${lowStockItems.length}`);
  console.log(`Customer feedback items: ${customerFeedback.length}`);
  console.log(`Sales statistics:`, salesStats);
}