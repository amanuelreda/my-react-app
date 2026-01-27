import React, { useState, useMemo } from 'react';
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

  const filteredProperties = useMemo(() => {
    return properties.filter(property => {
      if (filters.type !== 'all' && property.type !== filters.type) {
        return false;
      }
      const minPrice = filters.minPrice ? parseInt(filters.minPrice, 10) : 0;
      const maxPrice = filters.maxPrice ? parseInt(filters.maxPrice, 10) : Infinity;
      if (minPrice && property.price < minPrice) {
        return false;
      }
      if (maxPrice !== Infinity && property.price > maxPrice) {
        return false;
      }
      if (filters.bedrooms !== '0' && property.bedrooms < parseInt(filters.bedrooms, 10)) {
        return false;
      }
      return true;
    });
  }, [filters]);

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
