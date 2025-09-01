// 🔁 Added this import
import React from 'react';
import { useNavigate } from 'react-router-dom'; // ✅ ADDED
import { Container, Row, Col, Card } from 'react-bootstrap';
import { 
  FaUpload, 
  FaEdit, 
  FaSearch, 
  FaChartBar, 
  FaRobot, 
  FaHistory 
} from 'react-icons/fa';
import '../styles/Features.css';

const features = [
  {
    icon: <FaUpload size={24} />,
    title: "Resume & JD Upload",
    description: "Easily upload your resume and job descriptions to get started with optimization."
  },
  {
    icon: <FaEdit size={24} />,
    title: "Smart Resume Editor",
    description: "Intelligent editing tools that suggest improvements based on industry best practices."
  },
  {
    icon: <FaSearch size={24} />,
    title: "NLP Keyword Matching",
    description: "Advanced natural language processing to match keywords between your resume and job requirements."
  },
  {
    icon: <FaChartBar size={24} />,
    title: "ATS Score Feedback",
    description: "Real-time scoring to ensure your resume passes Applicant Tracking Systems."
  },
  {
    icon: <FaRobot size={24} />,
    title: "AI Chat Assistant",
    description: "Interactive AI assistant to help you improve your resume content and strategy."
  },
  {
    icon: <FaHistory size={24} />,
    title: "Resume Versioning + Tracker",
    description: "Manage multiple resume versions and track your application history efficiently."
  }
];

const Features = () => {
  const navigate = useNavigate(); // ✅ ADDED

  return (
    <section id="features" className="py-5">
      <Container>
        <h2 className="text-center mb-5 fw-bold" style={{ color: 'var(--dark-color)' }}>
          Powerful Features for Job Seekers
        </h2>
        <p className="text-center lead mb-5" style={{ color: 'black' }}>
          Everything you need to optimize your resume and land your dream job
        </p>
        
        <Row xs={1} md={2} lg={3} className="g-4">
          {features.map((feature, index) => (
            <Col key={index}>
              {/* 🔁 Updated this Card to make Resume & JD Upload clickable */}
              <Card
                className="h-100 border-0 shadow-sm feature-card"
                style={{
                  cursor: feature.title === "Resume & JD Upload" ? 'pointer' : 'default'
                }}
                onClick={() => {
                  if (feature.title === "Resume & JD Upload") {
                    navigate('/upload'); // ✅ navigate to upload page
                  }
                }}
              >
                <Card.Body className="p-4">
                  <div 
                    className="d-flex align-items-center justify-content-center mb-3 rounded-circle feature-icon" 
                    style={{
                      width: '50px',
                      height: '50px',
                      background: 'linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%)',
                      color: 'white'
                    }}
                  >
                    {feature.icon}
                  </div>
                  <Card.Title className="fw-bold" style={{ color: 'var(--dark-color)' }}>
                    {feature.title}
                  </Card.Title>
                  <Card.Text>{feature.description}</Card.Text>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      </Container>
    </section>
  );
};

export default Features;
