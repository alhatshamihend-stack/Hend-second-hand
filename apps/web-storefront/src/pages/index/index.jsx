// apps/web-storefront/src/pages/index/index.jsx
import React from 'react';

console.log(' NÖDSIDA LADDAS! INGA EXTERNA IMPORTS!');

export default function Index() {
  console.log(' KOMPONENT RENDERAS!');
  
  return (
    <div style={{ 
      padding: '40px', 
      background: '#ff0000', 
      minHeight: '100vh',
      color: '#ffffff',
      fontSize: '24px',
      fontWeight: 'bold'
    }}>
      OM DU SER DETTA RÖDA FÄLTET ÄR FRONTEND IGÅNG!
      <br /><br />
      Konsolloggar fungerar. Nu kan vi bygga vidare.
    </div>
  );
}
