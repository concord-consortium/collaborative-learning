import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import AppModeIndicator from './app-mode-indicator';

describe('AppModeIndicator', () => {
  test('renders nothing when appMode is "demo"', () => {
    render(<AppModeIndicator appMode="demo" />);
    expect(screen.queryByText(/Preview Mode/i)).toBeNull();
  });

  test('renders nothing when appMode is "authed"', () => {
    render(<AppModeIndicator appMode="authed" />);
    expect(screen.queryByText(/Preview Mode/i)).toBeNull();
  });

  test('renders preview mode indicator when appMode is "dev"', () => {
    render(<AppModeIndicator appMode="dev" />);
    expect(screen.getByText(/Preview Mode/i)).toBeInTheDocument();
    expect(screen.getByText(/Data will be deleted/i)).toBeInTheDocument();
  });

  test('displays tooltip with correct message when hovered over', async () => {
    render(<AppModeIndicator appMode="dev" />);
    const modeElement = screen.getByText(/Preview Mode/i);
    modeElement.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(await screen.findByText(/You are in preview mode/i)).toBeInTheDocument();
    expect(screen.getByText(/Any changes you make may be deleted after 24 hours/i)).toBeInTheDocument();
  });
});
