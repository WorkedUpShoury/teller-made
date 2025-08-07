import React from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import { 
  FaMagic, 
  FaFileAlt, 
  FaClipboardList,
  FaTachometerAlt 
} from 'react-icons/fa';

const steps = [
  {
    icon: <FaMagic size={24} />,
    title: "Optimize Resume",
    description: "Transform your resume with AI-powered keyword optimization and content enhancement. Get tailored suggestions that align with industry standards and job requirements."
  },
  {
    icon: <FaFileAlt size={24} />,
    title: "Generate Cover Letters",
    description: "Create compelling, personalized cover letters that complement your optimized resume. Our AI analyzes job descriptions to craft targeted messaging."
  },
  {
    icon: <FaClipboardList size={24} />,
    title: "Track Applications",
    description: "Monitor your job application progress with comprehensive tracking tools. Stay organized and follow up effectively with potential employers."
  }
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="py-5" style={{ backgroundColor: 'var(--light-color)' }}>
      <Container>
        <h2 className="text-center mb-5 fw-bold" style={{ color: 'var(--dark-color)' }}>How TellerMade Helps You</h2>
        <p className="text-center lead mb-5" style={{ color: 'black' }}>
          Streamline every aspect of your job search process
        </p>
        
        <Row className="g-4">
          {steps.map((step, index) => (
            <Col md={4} key={index}>
              <div className="p-4 h-100 bg-white rounded-3 shadow-sm">
                <div 
                  className="d-flex align-items-center justify-content-center mb-3 rounded-circle" 
                  style={{
                    width: '60px',
                    height: '60px',
                    background: 'linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%)',
                    color: 'white'
                  }}
                >
                  {step.icon}
                </div>
                <h4 className="fw-bold mb-3" style={{ color: 'var(--dark-color)' }}>{step.title}</h4>
                <p>{step.description}</p>
              </div>
            </Col>
          ))}
        </Row>
        
        {/* Admin Dashboard Section */}
        <Row className="mt-5 pt-5">
          <Col>
            <div className="bg-white p-4 rounded-3 shadow-sm d-flex align-items-start">
              <div className="me-4">
                <div 
                  className="d-flex align-items-center justify-content-center rounded-circle" 
                  style={{
                    width: '60px',
                    height: '60px',
                    background: 'linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%)',
                    color: 'white'
                  }}
                >
                  <FaTachometerAlt size={24} />
                </div>
              </div>
              <div>
                <h3 className="fw-bold mb-3" style={{ color: 'var(--dark-color)' }}>Admin Dashboard</h3>
                <p className="mb-0">
                  Comprehensive analytics and management tools for power users. Access detailed insights about your job search performance and optimization metrics.
                </p>
              </div>
            </div>
          </Col>
        </Row>
      </Container>
    </section>
  );
};

export default HowItWorks;