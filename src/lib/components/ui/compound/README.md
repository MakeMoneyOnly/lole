# Compound Component Pattern

This directory contains compound component implementations that address Composition Patterns audit findings.

## asChild Pattern

The `asChild` prop is a composition pattern that allows a component to render its child element instead of its own DOM element. This is powered by Radix UI's `Slot` primitive.

### How it works

When `asChild={true}` is passed, the component uses Radix's `Slot` to merge props onto the immediate child element rather than rendering its own wrapper. This enables:

- **Semantic HTML**: Use article, section, or other semantic elements inside Card
- **Styling flexibility**: Apply styles to existing elements without wrapper divs
- **Accessibility**: Preserve the natural HTML structure for screen readers

### Example Usage

```tsx
import { Card } from '@/lib/components/ui/compound/Card';

// Basic usage (renders div)
<Card.Root>
  <Card.Header>
    <Card.Title>Card Title</Card.Title>
  </Card.Header>
  <Card.Content>Content here</Card.Content>
</Card.Root>

// With asChild for semantic HTML
<Card.Root asChild>
  <article>
    <Card.Header>
      <Card.Title>Article Title</Card.Title>
    </Card.Header>
    <Card.Content>Article content</Card.Content>
  </article>
</Card.Root>
```

### Modal with asChild

```tsx
import { Modal } from '@/lib/components/ui/compound/Modal';
import { Button } from '@/components/ui/Button';

<Modal>
    <Modal.Trigger asChild>
        <Button variant="primary">Open Modal</Button>
    </Modal.Trigger>
    <ModalContent>
        <Modal.Header>
            <Modal.Title>Confirm Action</Modal.Title>
        </Modal.Header>
        <ModalDescription>Are you sure you want to proceed?</ModalDescription>
        <Modal.Footer>
            <Button>Confirm</Button>
            <Modal.Close asChild>
                <Button variant="ghost">Cancel</Button>
            </Modal.Close>
        </Modal.Footer>
    </ModalContent>
</Modal>;
```

## Compound Components

### Card Component

Available sub-components:

- `Card.Root` - The container component (supports `asChild`)
- `Card.Header` - Header section with bottom spacing
- `Card.Title` - Title heading (h3 by default)
- `Card.Description` - Descriptive text
- `Card.Content` - Main content area
- `Card.Footer` - Footer with top border

Props:

- `variant`: 'default' | 'glass' | 'elevated' | 'flat' | 'interactive'
- `padding`: 'none' | 'sm' | 'md' | 'lg'

### Modal Component

Available sub-components:

- `Modal` - Root dialog component
- `Modal.Trigger` - Button that opens the modal (supports `asChild`)
- `Modal.Portal` - Portal wrapper
- `Modal.Overlay` - Backdrop overlay (supports `asChild`)
- `Modal.Content` - Dialog content container (supports `asChild`)
- `Modal.Header` - Header section (supports `asChild`)
- `Modal.Footer` - Footer with action buttons (supports `asChild`)
- `Modal.Title` - Dialog title (supports `asChild`)
- `Modal.Description` - Dialog description (supports `asChild`)
- `Modal.Close` - Close button (supports `asChild`)

Props for Modal.Content:

- `size`: 'sm' | 'md' | 'lg' | 'xl' | 'full'
- `showClose`: boolean (default: true)

## Best Practices

1. **Use asChild when you need semantic HTML**: Article cards, section-based layouts
2. **Use asChild for custom styling**: When wrapping an element that already has base styles
3. **Don't overuse asChild**: It adds complexity; only use when needed
4. **Test accessibility**: Verify screen readers handle the composed structure correctly
