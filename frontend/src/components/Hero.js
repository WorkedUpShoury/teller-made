import React from 'react';
import { Container, Row, Col, Button } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';

const Hero = () => {
  const navigate = useNavigate();

  return (
    <section className="hero-section py-5">
      <Container>
        <Row className="align-items-center">
          <Col lg={6} className="mb-4 mb-lg-0">
            <h1 className="display-4 fw-bold mb-4">
              <span style={{ color: 'black' }}>Tailor Your Resume</span>{' '}
              <span style={{ color: 'var(--primary-color)' }}>with AI Precision</span>
            </h1>
            <p className="lead mb-4" style={{ color: 'black' }}>
              Upload resumes, optimize keywords, chat with AI, and pass ATS filters. 
              Transform your job search with intelligent automation.
            </p>
            <div className="d-flex gap-3">
              <Button variant="primary" size="lg" onClick={() => navigate('/upload')}>
                Try it Now
              </Button>
              <Button variant="outline-primary" size="lg">Watch Demo</Button>
            </div>
            <div className="mt-3 text-muted free-forever-text">
              <small>Free forever  • No credit card required</small>
            </div>
          </Col>
          <Col lg={6}>
            <div 
              className="rounded-3 p-4 text-center"
              style={{
                background: 'linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%)',
                color: 'white',
                height: '300px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <h3>AI Resume Optimization Illustration</h3>
            </div>
          </Col>
        </Row>
      </Container>
    </section>
  );
};

export default Hero;
