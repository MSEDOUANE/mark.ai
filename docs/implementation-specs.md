# MarkAI Implementation Specs

This document turns the product architecture into concrete route, component, and workflow specs that map to the current Next.js app.

## Workspace Shell

Primary navigation:
- Dashboard
- Generate
- Brands
- Projects
- Analyze
- Predict
- Retouch
- Library
- Templates
- Settings
- Billing
- Team Management
- Notifications
- Profile

Shared shell rules:
- Keep the left rail persistent on desktop.
- Use drawers for inspection and editing when the user should stay in context.
- Preserve draft state across route changes.
- Surface long-running work in notifications and job progress UI.

## Route Specs

### Dashboard

Purpose:
- Command center for the workspace.

Required sections:
- Recent Projects
- Recent AI Generations
- Credits Remaining
- Usage Analytics
- Performance Summary
- Favorite Brands
- Quick Generate Buttons
- Recently Edited Assets
- Recent AI Conversations
- Pinned Projects
- Notifications
- Team Activity

Data sources:
- campaigns
- creatives
- generations
- reports
- brand_profiles
- audit_log
- alerts

### Generate

Purpose:
- Hub for all AI creation workflows.

Tabs:
- Most Popular
- Images
- Videos
- Product Ads
- Social Posts
- Text
- Audience
- Voice
- Audio
- Animation

### Product Ads

Entry point:
- Generate hub or direct quick action.

Workflow:
1. Upload product
2. Detect object
3. Remove background
4. Choose scene
5. Choose style
6. Generate lifestyle image
7. Generate ad variations
8. Generate headlines
9. Generate CTA
10. Export

Dependencies:
- product-photos client
- upload asset route
- ad copy generator

### Voice

Entry point:
- Generate hub or video workflow.

Workflow:
1. Select language
2. Choose voice
3. Enter script
4. Preview pronunciation
5. Generate voiceover
6. Add music bed
7. Export

Dependencies:
- audio studio client
- audio routes
- video studio export flow

### Animation

Entry point:
- Generate hub or image workflow.

Workflow:
1. Upload image
2. Set motion intent
3. Generate clip
4. Preview
5. Download or reuse in Video Studio

Dependencies:
- /api/upload-asset
- /api/animate-photo

## Component Specs

Reusable primitives:
- SidebarNav
- MobileNav
- QuickCard
- StatCard
- Command palette
- Drawer
- Modal
- Toast
- Breadcrumbs
- Metric card
- Progress bar
- Gallery tile
- Timeline editor

Workflow components:
- Brand picker
- Product picker
- Prompt editor
- Asset picker
- Variant grid
- Timeline
- Canvas
- Voice picker
- Avatar picker
- Upload panel

## Dashboard Command Center

Recommended modules:
- Usage analytics cards
- Recent projects list
- Recent AI generations list
- Favorite brands list
- Recent AI conversations
- Team activity stream
- Notifications and alerts

Behavior:
- Use real data from campaigns, generations, brand profiles, audit logs, and alerts.
- Show empty states when a section has no items.
- Keep cards clickable so the user can drill into the owning module.

## Data and Event Contracts

Important entities:
- organizations
- profiles
- memberships
- brand_profiles
- products
- campaigns
- creatives
- generations
- reports
- alerts
- approvals
- landing_pages
- video_projects
- whatsapp_messages
- audit_log

Event types:
- generation.requested
- generation.completed
- generation.failed
- approval.requested
- approval.approved
- approval.rejected
- campaign.created
- campaign.launched
- alert.raised
- report.published
- assistant.chat

## Build Order

1. Complete remaining Generate pages.
2. Add deeper project and library drill-down screens.
3. Wire pinned projects, credits, and richer notification delivery.
4. Add command palette and keyboard shortcuts if not already present.
5. Expand the dashboard with background job tracking and activity history.