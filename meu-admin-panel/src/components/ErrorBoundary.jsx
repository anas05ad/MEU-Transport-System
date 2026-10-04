import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('[boundary]', error, info); }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="state" style={{ minHeight: '60vh' }}>
        <h3 className="state__title">{this.props.title}</h3>
        <p className="state__body" style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>
          {String(this.state.error?.message || this.state.error)}
        </p>
        <button className="btn btn--secondary" onClick={() => window.location.reload()}>
          {this.props.reloadLabel}
        </button>
      </div>
    );
  }
}
