import React from 'react'

function App() {
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 mb-6 text-center">
        Viral Referral & Loyalty Engine
      </h1>
      <p className="text-lg md:text-xl text-gray-300 mb-8 text-center max-w-2xl">
        Scaffolded successfully. Ready to build the next big viral growth loop!
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 hover:border-purple-500 transition-colors">
          <h2 className="text-xl font-bold mb-2">🚀 Refer & Earn</h2>
          <p className="text-gray-400">Invite friends and unlock exclusive rewards.</p>
        </div>
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 hover:border-pink-500 transition-colors">
          <h2 className="text-xl font-bold mb-2">🎁 Loyalty Points</h2>
          <p className="text-gray-400">Earn points for every action you take.</p>
        </div>
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 hover:border-indigo-500 transition-colors">
          <h2 className="text-xl font-bold mb-2">📈 Growth Loop</h2>
          <p className="text-gray-400">Watch your user base grow exponentially.</p>
        </div>
      </div>
    </div>
  )
}

export default App
