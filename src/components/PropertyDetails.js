import React from 'react';
import './PropertyDetails.css';

function PropertyDetails({ property, onClose }) {
  if (!property) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>×</button>
        <img src={property.image} alt={property.title} className="detail-image" />
        <div className="detail-content">
          <div className="property-type-badge">
            {property.type === 'apartment' ? '🏢 Apartment' : '🏡 House'}
          </div>
          <h2>{property.title}</h2>
          <p className="detail-address">📍 {property.address}</p>
          <p className="detail-location">{property.city}, {property.state}</p>
          
          <div className="detail-price">${property.price}/month</div>
          
          <div className="detail-specs">
            <div className="spec">
              <span className="spec-label">Bedrooms</span>
              <span className="spec-value">🛏️ {property.bedrooms}</span>
            </div>
            <div className="spec">
              <span className="spec-label">Bathrooms</span>
              <span className="spec-value">🚿 {property.bathrooms}</span>
            </div>
            <div className="spec">
              <span className="spec-label">Square Feet</span>
              <span className="spec-value">📐 {property.sqft}</span>
            </div>
          </div>
          
          <div className="detail-description">
            <h3>Description</h3>
            <p>{property.description}</p>
          </div>
          
          <div className="detail-amenities">
            <h3>Amenities</h3>
            <div className="amenities-list">
              {property.amenities.map((amenity, index) => (
                <span key={index} className="amenity-badge">✓ {amenity}</span>
              ))}
            </div>
          </div>
          
          <button className="contact-button">Contact Agent</button>
        </div>
      </div>
    </div>
  );
}

export default PropertyDetails;
