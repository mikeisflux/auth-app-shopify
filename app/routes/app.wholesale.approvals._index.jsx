// Approval Workflow - Manage Wholesale Customer Approvals
import { json } from "@remix-run/node";
import { useLoaderData, useActionData, useNavigate, useSubmit } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  DataTable,
  Button,
  BlockStack,
  InlineStack,
  Banner,
  Text,
  Badge,
  TextField,
  EmptyState
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { query } from "../db/connection.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  // Get all approval requests
  const allRequestsResult = await query(
    `SELECT ar.*, wc.email as customer_email, wc.shopify_customer_id
     FROM approval_requests ar
     INNER JOIN wholesale_customers wc ON ar.customer_id = wc.id
     INNER JOIN shops s ON ar.shop_id = s.id
     WHERE s.shop_domain = $1
     ORDER BY
       CASE WHEN ar.status = 'pending' THEN 0 ELSE 1 END,
       ar.created_at DESC`,
    [shopDomain]
  );

  // Get statistics
  const statsResult = await query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
       COUNT(*) FILTER (WHERE status = 'approved') as approved_count,
       COUNT(*) FILTER (WHERE status = 'rejected') as rejected_count,
       AVG(EXTRACT(EPOCH FROM (reviewed_at - created_at))/3600) FILTER (WHERE reviewed_at IS NOT NULL) as avg_response_hours
     FROM approval_requests ar
     INNER JOIN shops s ON ar.shop_id = s.id
     WHERE s.shop_domain = $1`,
    [shopDomain]
  );

  return json({
    requests: allRequestsResult.rows || [],
    stats: statsResult.rows[0] || { pending_count: 0, approved_count: 0, rejected_count: 0, avg_response_hours: 0 }
  });
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const formData = await request.formData();
  const actionType = formData.get('actionType');

  try {
    if (actionType === 'approve' || actionType === 'reject') {
      const requestId = formData.get('requestId');
      const customerId = formData.get('customerId');
      const reviewNotes = formData.get('reviewNotes') || '';
      const newStatus = actionType === 'approve' ? 'approved' : 'rejected';

      // Update approval request
      await query(
        `UPDATE approval_requests
         SET status = $1,
             reviewed_by = $2,
             reviewed_at = CURRENT_TIMESTAMP,
             review_notes = $3
         WHERE id = $4`,
        [newStatus, session.shop, reviewNotes, requestId]
      );

      // If approved, update customer wholesale_approved status
      if (actionType === 'approve') {
        await query(
          `UPDATE wholesale_customers wc
           SET wholesale_approved = true,
               approval_date = CURRENT_TIMESTAMP,
               approved_by = $1
           FROM shops s
           WHERE wc.id = $2
             AND wc.shop_id = s.id
             AND s.shop_domain = $3`,
          [session.shop, customerId, shopDomain]
        );
      }

      return json({
        success: true,
        message: `Request ${actionType === 'approve' ? 'approved' : 'rejected'}!`
      });
    }

    return json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return json({ error: error.message }, { status: 400 });
  }
};

export default function ApprovalsIndex() {
  const { requests, stats } = useLoaderData();
  const actionData = useActionData();
  const navigate = useNavigate();
  const submit = useSubmit();

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const processedRequests = requests.filter(r => r.status !== 'pending');

  const handleApprove = (requestId, customerId) => {
    const notes = prompt('Approval notes (optional):');
    const formData = new FormData();
    formData.append('actionType', 'approve');
    formData.append('requestId', requestId);
    formData.append('customerId', customerId);
    formData.append('reviewNotes', notes || '');
    submit(formData, { method: 'post' });
  };

  const handleReject = (requestId, customerId) => {
    const notes = prompt('Rejection reason:');
    if (!notes) return;

    const formData = new FormData();
    formData.append('actionType', 'reject');
    formData.append('requestId', requestId);
    formData.append('customerId', customerId);
    formData.append('reviewNotes', notes);
    submit(formData, { method: 'post' });
  };

  const pendingRows = pendingRequests.map(req => {
    const daysPending = Math.floor(
      (new Date() - new Date(req.created_at)) / (1000 * 60 * 60 * 24)
    );

    return [
      req.customer_email,
      req.request_type.replace('_', ' '),
      req.requested_by || 'Customer',
      new Date(req.created_at).toLocaleDateString(),
      <Badge key={req.id} tone={daysPending > 3 ? 'warning' : 'info'}>
        {daysPending} days
      </Badge>,
      <InlineStack gap="200" key={req.id}>
        <Button
          size="slim"
          variant="primary"
          onClick={() => handleApprove(req.id, req.customer_id)}
        >
          Approve
        </Button>
        <Button
          size="slim"
          destructive
          onClick={() => handleReject(req.id, req.customer_id)}
        >
          Reject
        </Button>
        <Button
          size="slim"
          onClick={() => navigate(`/app/wholesale/customers/${req.customer_id}`)}
        >
          View Customer
        </Button>
      </InlineStack>
    ];
  });

  const processedRows = processedRequests.map(req => [
    req.customer_email,
    req.request_type.replace('_', ' '),
    new Date(req.created_at).toLocaleDateString(),
    req.reviewed_at ? new Date(req.reviewed_at).toLocaleDateString() : '-',
    req.reviewed_by || '-',
    <Badge key={req.id} tone={req.status === 'approved' ? 'success' : 'critical'}>
      {req.status}
    </Badge>,
    req.review_notes || '-'
  ]);

  return (
    <Page
      title="Approval Requests"
      subtitle="Manage wholesale customer approval requests"
      backAction={{ onAction: () => navigate('/app/wholesale') }}
    >
      <Layout>
        <Layout.Section>
          {actionData?.success && (
            <Banner status="success" onDismiss={() => {}}>
              <p>{actionData.message}</p>
            </Banner>
          )}

          {actionData?.error && (
            <Banner status="critical">
              <p>{actionData.error}</p>
            </Banner>
          )}

          {/* Statistics Cards */}
          <InlineStack gap="400" wrap={false}>
            <Card>
              <BlockStack gap="200">
                <Text variant="bodySm" tone="subdued">Pending Approvals</Text>
                <Text variant="heading2xl" as="p" tone={stats.pending_count > 5 ? 'critical' : 'subdued'}>
                  {stats.pending_count}
                </Text>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="200">
                <Text variant="bodySm" tone="subdued">Total Approved</Text>
                <Text variant="heading2xl" as="p" tone="success">
                  {stats.approved_count}
                </Text>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="200">
                <Text variant="bodySm" tone="subdued">Total Rejected</Text>
                <Text variant="heading2xl" as="p">
                  {stats.rejected_count}
                </Text>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="200">
                <Text variant="bodySm" tone="subdued">Avg Response Time</Text>
                <Text variant="heading2xl" as="p">
                  {stats.avg_response_hours ? `${Math.round(stats.avg_response_hours)}h` : 'N/A'}
                </Text>
              </BlockStack>
            </Card>
          </InlineStack>

          {/* Pending Requests */}
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Pending Requests</Text>

              {pendingRequests.length > 0 ? (
                <DataTable
                  columnContentTypes={['text', 'text', 'text', 'text', 'text', 'text']}
                  headings={[
                    'Customer Email',
                    'Request Type',
                    'Requested By',
                    'Request Date',
                    'Pending',
                    'Actions'
                  ]}
                  rows={pendingRows}
                />
              ) : (
                <EmptyState
                  heading="No pending requests"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>All approval requests have been processed.</p>
                </EmptyState>
              )}
            </BlockStack>
          </Card>

          {/* Processed Requests */}
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Recently Processed</Text>

              {processedRequests.length > 0 ? (
                <DataTable
                  columnContentTypes={['text', 'text', 'text', 'text', 'text', 'text', 'text']}
                  headings={[
                    'Customer Email',
                    'Request Type',
                    'Request Date',
                    'Reviewed Date',
                    'Reviewed By',
                    'Status',
                    'Notes'
                  ]}
                  rows={processedRows}
                />
              ) : (
                <Text tone="subdued">No processed requests yet</Text>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">Approval Workflow</Text>
              <BlockStack gap="100">
                <Text variant="bodySm">
                  <strong>1. Customer Requests Access</strong>
                </Text>
                <Text variant="bodySm" tone="subdued">
                  Customers submit wholesale access requests through your storefront or are auto-created when they sign up.
                </Text>

                <Text variant="bodySm">
                  <strong>2. Review Request</strong>
                </Text>
                <Text variant="bodySm" tone="subdued">
                  Review customer details and business information before approving.
                </Text>

                <Text variant="bodySm">
                  <strong>3. Approve or Reject</strong>
                </Text>
                <Text variant="bodySm" tone="subdued">
                  Approved customers get wholesale pricing immediately. Rejected customers can reapply.
                </Text>
              </BlockStack>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">Quick Tips</Text>
              <BlockStack gap="100">
                <Text variant="bodySm">
                  • Respond to requests within 24-48 hours
                </Text>
                <Text variant="bodySm">
                  • Add notes explaining approval/rejection
                </Text>
                <Text variant="bodySm">
                  • Review customer order history before approving
                </Text>
                <Text variant="bodySm">
                  • Set up auto-approval for trusted domains
                </Text>
              </BlockStack>
            </BlockStack>
          </Card>

          {stats.pending_count > 5 && (
            <Banner status="warning">
              <p>You have {stats.pending_count} pending requests. Consider reviewing them soon to maintain good customer experience.</p>
            </Banner>
          )}
        </Layout.Section>
      </Layout>
    </Page>
  );
}
