# CLUE (Collaborative Learning User Environment) Project Overview

## Introduction

CLUE is a sophisticated web-based collaborative learning platform developed by The Concord Consortium. The platform enables real-time collaboration among students working on educational activities, providing a rich, interactive learning environment.

## Technical Architecture

### Core Technologies

- **Frontend Framework**: React with TypeScript
- **State Management**: MobX State Tree (Concord custom version)
- **Database Layer**:
  - Firebase Realtime Database
  - Cloud Firestore
- **Cloud Infrastructure**: Firebase Cloud Functions (v1 and v2)
- **Build System**: Webpack
- **Testing Framework**:
  - Jest (unit/integration)
  - Cypress (integration/end-to-end)

### Key Libraries and Dependencies

#### UI Components and Visualization

- Chakra UI for core components
- Custom Concord React Components
- DND Kit for drag-and-drop functionality
- Floating UI for popover interfaces
- VISX and D3 for data visualization
- Chart.js for graphing

#### Data and Computation

- Concord Compute Engine
- CODAP's formula system is used for formula in tables. This included via the `@concord-consortium/codap-formulas-react17` dependency. Under the hood it uses MathJs.
- Firebase SDK for database operations
- Custom state management solutions
- MathJs is also used by the diagram tile for equation evaluation.

## Project Structure

### Directory Organization

```
/
├── src/            # Main application source code
├── shared/         # Shared components and utilities
├── functions-v1/   # Legacy Firebase Cloud Functions
├── functions-v2/   # Current Firebase Cloud Functions
├── cms/           # Content Management System
├── cypress/       # End-to-end tests
├── docs/          # Project documentation
├── scripts/       # Build and deployment scripts
└── migrations/    # Database migration scripts
```

## Development Practices

### Code Quality Standards

1. **TypeScript Implementation**
   - Strong typing enforcement
   - Interface-driven development
   - Comprehensive type definitions

2. **Testing Requirements**
   - Unit tests for core functionality
   - Integration tests for component interaction
   - End-to-end tests for user workflows
   - Coverage tracking via Codecov

3. **Code Style**
   - ESLint configuration
   - Consistent formatting
   - Documentation requirements

### Development Workflow

1. **Environment Configurations**
   - Development
   - Branches and versions deployed to static URLs
   - Production

2. **Deployment Process**
   - Automated GitHub Actions workflows
   - Branch deployments (`collaborative-learning.concord.org/branch/<n>/`)
   - Version deployments (`collaborative-learning.concord.org/version/<n>/`)
   - Manual production release process

3. **Database Management**
   - Tested Firestore rules
   - Tested Realtime Database rules
   - Emulator support for local development

## Features and Capabilities

### Debug Support

The application includes extensive debugging capabilities through localStorage flags:

- Bookmark tracking
- Canvas debugging
- Document management
- Firebase/Firestore operations
- History tracking
- Loading process monitoring
- Shared model debugging

### URL Parameters

Comprehensive URL parameter support for:

- Application mode selection
- Unit and problem configuration
- Demo functionality
- User simulation
- Database targeting
- UI configuration options

### Document Editor

Standalone editor available at `/editor/` supporting:

- Local file system operations
- Remote document loading
- Session storage management
- Read-only mode
- UI-less mode for documentation

## Testing Infrastructure

### Unit Testing

- Jest framework
- Component testing
- Service testing
- Utility function testing

### End-to-End Testing

- Cypress test suite
- Real-world scenario testing
- Cross-browser compatibility
- Performance monitoring

### Coverage Requirements

- Automated coverage tracking
- Integration with CI/CD
- Coverage reporting in PRs

## Documentation

The project maintains extensive documentation covering:

- API references
- Component documentation
- Database schemas
- Deployment procedures
- Development guides
- Testing guidelines

## License

CLUE is distributed under the MIT License, Copyright 2018 by the Concord Consortium.

## Additional Resources

- [Deployment Guide](deploy.md)
- [Firebase Schema](firebase-schema.md)
- [Firestore Schema](firestore-schema.md)
- [CMS Documentation](cms.md)
- [Document Types](document-types.md)
- [Testing Coverage](cypress-coverage.md)
