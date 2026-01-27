import React, { useState } from 'react';
import Header from './components/Header';
import SearchFilter from './components/SearchFilter';
import PropertyList from './components/PropertyList';
import PropertyDetails from './components/PropertyDetails';
import { properties } from './data/properties';
import './App.css';

function App() {
  const [filters, setFilters] = useState({
    type: 'all',
    minPrice: '',
    maxPrice: '',
    bedrooms: '0'
  });
  const [selectedProperty, setSelectedProperty] = useState(null);

  const filteredProperties = properties.filter(property => {
    if (filters.type !== 'all' && property.type !== filters.type) {
      return false;
    }
    if (filters.minPrice && property.price < parseInt(filters.minPrice)) {
      return false;
    }
    if (filters.maxPrice && property.price > parseInt(filters.maxPrice)) {
      return false;
    }
    if (filters.bedrooms !== '0' && property.bedrooms < parseInt(filters.bedrooms)) {
      return false;
    }
    return true;
  });

  return (
    <div className="App">
      <Header />
      <main className="main-content">
        <div className="hero">
          <h2>Find Your Perfect Home</h2>
          <p>Browse our selection of apartments and single family homes</p>
        </div>
        <SearchFilter filters={filters} onFilterChange={setFilters} />
        <div className="results-count">
          {filteredProperties.length} {filteredProperties.length === 1 ? 'property' : 'properties'} found
        </div>
        <PropertyList 
          properties={filteredProperties} 
          onPropertyClick={setSelectedProperty}
        />
      </main>
      {selectedProperty && (
        <PropertyDetails 
          property={selectedProperty} 
          onClose={() => setSelectedProperty(null)}
        />
      )}
    </div>
  );
}

export default App;
