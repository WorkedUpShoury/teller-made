import React from 'react';
import { Container, Row, Col, Button } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import '../styles/Hero.css'; // ✅ custom animations

const Hero = () => {
  const navigate = useNavigate();

  // Sample data for the resume versions chart
  const resumeData = [
    { name: 'ATS Optimized', versions: 8, fill: 'rgba(255, 255, 255, 0.9)' },
    { name: 'Tech Roles', versions: 12, fill: 'rgba(255, 255, 255, 0.8)' },
    { name: 'Creative Gigs', versions: 5, fill: 'rgba(255, 255, 255, 0.7)' },
    { name: 'Needs Review', versions: 2, fill: 'rgba(255, 255, 255, 0.6)' },
  ];

  return (
    <section className="hero-section py-5">
      <Container>
        <Row className="align-items-center">
          {/* Left Section */}
          <Col lg={6} className="mb-5 mb-lg-0 fade-in-left">
            <h1 className="display-4 fw-bold mb-4">
              <span style={{ color: 'black' }}>Tailor Your Resume</span>{' '}
              <span style={{ color: 'var(--primary-color)' }}>with AI Precision</span>
            </h1>
            <p className="lead mb-4" style={{ color: 'black' }}>
              Upload resumes, optimize keywords, chat with AI, and pass ATS filters. 
              Transform your job search with intelligent automation.
            </p>
            <div className="d-flex gap-3">
              <Button 
                size="lg" 
                className="btn-animate"
                onClick={() => navigate('/upload')}
              >
                Try it Now
              </Button>
              <Button variant="outline-primary" size="lg" className="btn-animate-outline">
                Watch Demo
              </Button>
            </div>
            <div className="mt-3 text-muted free-forever-text fade-in-up">
              <small>Free forever  • No credit card required</small>
            </div>
          </Col>

          {/* Right Section - Replaced with Chart */}
          <Col lg={6} className="fade-in-right">
            <div 
              className="rounded-3 p-4 text-center hero-illustration"
              style={{
                background: 'linear-gradient(135deg, #932ac6, #a92dba, #ff2d92)',
                color: 'white',
                height: '350px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <h5 className="mb-3 fw-bold">Resume Version Analysis</h5>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart
                  data={resumeData}
                  margin={{
                    top: 10,
                    right: 30,
                    left: 0,
                    bottom: 0,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.2)" />
                  <XAxis dataKey="name" stroke="white" fontSize={12} />
                  <YAxis stroke="white" fontSize={12} />
                  <Tooltip
                    cursor={{ fill: 'rgba(255, 255, 255, 0.1)' }}
                    contentStyle={{
                      background: 'rgba(0, 0, 0, 0.7)',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      borderRadius: '0.5rem'
                    }}
                  />
                  <Bar dataKey="versions" fill="rgba(255, 255, 255, 0.8)" barSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Col>
        </Row>
      </Container>
    </section>
  );
};

export default Hero;