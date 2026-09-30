import { useState, useEffect } from 'react';

function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [chatMessages, setChatMessages] = useState<{role: string, text: string}[]>([
    { role: 'ai', text: 'سلام! من ایجنت هوش مصنوعی مهندسی هستم. در چه زمینه‌ای می‌تونم کمکتون کنم؟' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [animatedStats, setAnimatedStats] = useState({ projects: 0, efficiency: 0, energy: 0, accuracy: 0 });

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedStats({ projects: 150, efficiency: 98, energy: 35, accuracy: 99 });
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const handleSend = () => {
    if (!chatInput.trim()) return;
    const userMsg = { role: 'user', text: chatInput };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    
    setTimeout(() => {
      const responses: Record<string, string> = {
        'پتروشیمی': 'در زمینه فرآیندهای پتروشیمی، من می‌تونم در بهینه‌سازی ریفرمینگ، کراکینگ، و فرآیندهای جداسازی کمکتون کنم.',
        'انرژی': 'برای بهینه‌سازی مصرف انرژی، تحلیل Pinch و بازیابی حرارت از تخصص‌های منه.',
        'داده': 'در آنالیز داده‌های صنعتی و طراحی دیتابیس‌های فرآیندی تجربه کامل دارم.',
        'هوش مصنوعی': 'می‌تونم مدل‌های ML برای پیش‌بینی عملکرد تجهیزات و کنترل بهینه فرآیند طراحی کنم.',
      };
      
      let response = 'سوال جالبی بود! بذارید بیشتر توضیح بدم...';
      for (const [key, val] of Object.entries(responses)) {
        if (chatInput.includes(key)) {
          response = val;
          break;
        }
      }
      
      setChatMessages(prev => [...prev, { role: 'ai', text: response }]);
    }, 1000);
  };

  const expertiseAreas = [
    {
      id: 'chemical',
      title: 'مهندسی شیمی و پتروشیمی',
      icon: '🧪',
      description: 'طراحی و بهینه‌سازی فرآیندهای پتروشیمی، ریفرمینگ، کراکینگ، پلیمریزاسیون و جداسازی',
      skills: ['طراحی فرآیند', 'شبیه‌سازی ASPEN', 'HYSYS', 'کنترل فرآیند', 'ترمودینامیک'],
      color: 'from-blue-500 to-cyan-500'
    },
    {
      id: 'energy',
      title: 'بهینه‌سازی انرژی',
      icon: '⚡',
      description: 'آنالیز Pinch، بازیابی حرارت، بهینه‌سازی مصرف انرژی و تولید پایدار',
      skills: ['آنالیز Pinch', 'بازیابی حرارت', 'CHP', 'انرژی‌های تجدیدپذیر', 'ردیابی کربن'],
      color: 'from-green-500 to-emerald-500'
    },
    {
      id: 'ai',
      title: 'هوش مصنوعی و اتوماسیون',
      icon: '🤖',
      description: 'پیاده‌سازی مدل‌های ML/DL برای پیش‌بینی، کنترل هوشمند و اتوماسیون صنعتی',
      skills: ['یادگیری عمیق', 'شبکه‌های عصبی', 'کنترل پیش‌بینانه', 'رباتیک صنعتی', 'IoT'],
      color: 'from-purple-500 to-violet-500'
    },
    {
      id: 'data',
      title: 'آنالیز داده و دیتابیس',
      icon: '📊',
      description: 'طراحی دیتابیس‌های صنعتی، آنالیز داده‌های فرآیندی و مصورسازی',
      skills: ['SQL/NoSQL', 'Python/Pandas', 'Power BI', 'Time Series', 'Big Data'],
      color: 'from-orange-500 to-amber-500'
    },
    {
      id: 'software',
      title: 'نرم‌افزار مهندسی',
      icon: '💻',
      description: 'توسعه نرم‌افزارهای تخصصی مهندسی، شبیه‌سازی و ابزارهای محاسباتی',
      skills: ['MATLAB', 'Python', 'C++', 'LabVIEW', 'SCADA/DCS'],
      color: 'from-rose-500 to-pink-500'
    }
  ];

  return (
    <div className="min-h-screen bg-[#0a0e1a] relative overflow-hidden">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl"></div>
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(rgba(59,130,246,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.3) 1px, transparent 1px)',
          backgroundSize: '60px 60px'
        }}></div>
      </div>

      {/* Header */}
      <header className="relative z-10 glass border-b border-blue-500/10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-2xl animate-pulse-glow">
              🧠
            </div>
            <div>
              <h1 className="text-xl font-bold gradient-text">AI Engineering Agent</h1>
              <p className="text-xs text-slate-400">ایجنت هوش مصنوعی مهندسی</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/30">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-green-400 text-sm">آنلاین</span>
            </div>
            <nav className="hidden md:flex gap-1">
              {['overview', 'expertise', 'chat'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-lg text-sm transition-all ${
                    activeTab === tab 
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {tab === 'overview' ? '🏠 نمای کلی' : tab === 'expertise' ? '🎯 تخصص‌ها' : '💬 گفتگو'}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 py-8">
        
        {/* Hero Section */}
        {activeTab === 'overview' && (
          <div className="animate-fadeInUp">
            <section className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-6">
                <span className="text-yellow-400">✨</span>
                <span className="text-sm text-slate-300">آماده خدمت‌رسانی در ۵ حوزه تخصصی</span>
              </div>
              <h2 className="text-4xl md:text-6xl font-black mb-4">
                <span className="gradient-text">ایجنت هوش مصنوعی</span>
                <br />
                <span className="text-white">مهندسی و صنعت</span>
              </h2>
              <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
                ترکیبی از دانش مهندسی شیمی، بهینه‌سازی انرژی، هوش مصنوعی و آنالیز داده
                برای حل مسائل پیچیده صنعتی
              </p>
            </section>

            {/* Stats */}
            <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
              {[
                { label: 'پروژه موفق', value: animatedStats.projects, suffix: '+', icon: '🏆' },
                { label: 'بهره‌وری فرآیند', value: animatedStats.efficiency, suffix: '%', icon: '📈' },
                { label: 'کاهش مصرف انرژی', value: animatedStats.energy, suffix: '%', icon: '🌱' },
                { label: 'دقت پیش‌بینی', value: animatedStats.accuracy, suffix: '%', icon: '🎯' },
              ].map((stat, i) => (
                <div key={i} className="glass-card rounded-2xl p-6 text-center">
                  <div className="text-3xl mb-2">{stat.icon}</div>
                  <div className="text-3xl font-black gradient-text mb-1">
                    {stat.value}{stat.suffix}
                  </div>
                  <div className="text-sm text-slate-400">{stat.label}</div>
                </div>
              ))}
            </section>

            {/* Quick Expertise Cards */}
            <section className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
              {expertiseAreas.map((area, i) => (
                <div 
                  key={area.id} 
                  className="glass-card rounded-2xl p-6 cursor-pointer"
                  style={{ animationDelay: `${i * 0.1}s` }}
                  onClick={() => setActiveTab('expertise')}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-3xl">{area.icon}</span>
                    <h3 className="text-lg font-bold text-white">{area.title}</h3>
                  </div>
                  <p className="text-sm text-slate-400 leading-relaxed mb-4">{area.description}</p>
                  <div className="flex flex-wrap gap-2">
                    {area.skills.slice(0, 3).map((skill, j) => (
                      <span key={j} className="px-2 py-1 rounded-md bg-white/5 text-xs text-slate-300 border border-white/10">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </section>

            {/* Architecture Diagram */}
            <section className="glass-card rounded-2xl p-8 mb-12">
              <h3 className="text-2xl font-bold text-white mb-6 text-center">🏗️ معماری سیستم هوشمند</h3>
              <div className="grid md:grid-cols-5 gap-4">
                {['داده‌های ورودی', 'پیش‌پردازش', 'مدل AI', 'بهینه‌سازی', 'خروجی صنعتی'].map((step, i) => (
                  <div key={i} className="text-center">
                    <div className={`w-16 h-16 mx-auto rounded-xl bg-gradient-to-br ${
                      ['from-blue-500/20 to-blue-600/20', 'from-cyan-500/20 to-cyan-600/20', 'from-purple-500/20 to-purple-600/20', 'from-green-500/20 to-green-600/20', 'from-orange-500/20 to-orange-600/20'][i]
                    } border border-white/10 flex items-center justify-center text-2xl mb-2`}>
                      {['📥', '⚙️', '🧠', '📊', '📤'][i]}
                    </div>
                    <p className="text-sm text-slate-300">{step}</p>
                    {i < 4 && (
                      <div className="hidden md:block absolute left-0 top-1/2 text-blue-400">←</div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* Expertise Tab */}
        {activeTab === 'expertise' && (
          <div className="animate-fadeInUp">
            <h2 className="text-3xl font-black text-white mb-8 text-center">
              🎯 حوزه‌های تخصصی
            </h2>
            <div className="space-y-8">
              {expertiseAreas.map((area, i) => (
                <div key={area.id} className="glass-card rounded-2xl p-8">
                  <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex-shrink-0">
                      <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${area.color} bg-opacity-20 flex items-center justify-center text-4xl`}>
                        {area.icon}
                      </div>
                    </div>
                    <div className="flex-grow">
                      <h3 className="text-2xl font-bold text-white mb-2">{area.title}</h3>
                      <p className="text-slate-400 mb-4 leading-relaxed">{area.description}</p>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {area.skills.map((skill, j) => (
                          <span key={j} className={`px-3 py-1.5 rounded-lg bg-gradient-to-r ${area.color} bg-opacity-10 text-sm text-white border border-white/10`}>
                            {skill}
                          </span>
                        ))}
                      </div>
                      {/* Progress bars */}
                      <div className="space-y-2">
                        {area.skills.slice(0, 3).map((skill, j) => (
                          <div key={j} className="flex items-center gap-3">
                            <span className="text-xs text-slate-400 w-28">{skill}</span>
                            <div className="flex-grow h-2 bg-white/5 rounded-full overflow-hidden">
                              <div 
                                className={`h-full progress-bar bg-gradient-to-r ${area.color}`}
                                style={{ width: `${85 + Math.random() * 15}%` }}
                              ></div>
                            </div>
                            <span className="text-xs text-slate-400">{85 + Math.floor(Math.random() * 15)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chat Tab */}
        {activeTab === 'chat' && (
          <div className="animate-fadeInUp max-w-3xl mx-auto">
            <h2 className="text-3xl font-black text-white mb-8 text-center">
              💬 گفتگو با ایجنت
            </h2>
            <div className="glass-card rounded-2xl overflow-hidden">
              {/* Chat Header */}
              <div className="p-4 border-b border-white/10 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xl">
                  🧠
                </div>
                <div>
                  <p className="font-bold text-white">ایجنت AI مهندسی</p>
                  <p className="text-xs text-green-400">● آنلاین - آماده پاسخگویی</p>
                </div>
              </div>
              
              {/* Messages */}
              <div className="p-4 h-96 overflow-y-auto space-y-4">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      msg.role === 'user' 
                        ? 'bg-blue-500/20 border border-blue-500/30 text-blue-100' 
                        : 'bg-white/5 border border-white/10 text-slate-200'
                    }`}>
                      <p className="text-sm leading-relaxed">{msg.text}</p>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Input */}
              <div className="p-4 border-t border-white/10">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="سوال خود را بنویسید... (مثلاً: پتروشیمی، انرژی، هوش مصنوعی)"
                    className="flex-grow bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-colors"
                  />
                  <button
                    onClick={handleSend}
                    className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl text-white font-bold hover:opacity-90 transition-opacity"
                  >
                    ارسال ✉️
                  </button>
                </div>
                <div className="flex gap-2 mt-3 flex-wrap">
                  {['پتروشیمی', 'انرژی', 'داده', 'هوش مصنوعی'].map(tag => (
                    <button
                      key={tag}
                      onClick={() => { setChatInput(tag); }}
                      className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-slate-400 hover:text-white hover:border-blue-500/50 transition-all"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 glass border-t border-white/5 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6 text-center">
          <p className="text-slate-500 text-sm">
            🧠 ایجنت هوش مصنوعی مهندسی | طراحی شده برای حل مسائل پیچیده صنعتی
          </p>
          <div className="flex justify-center gap-4 mt-3">
            <span className="text-xs text-slate-600">مهندسی شیمی</span>
            <span className="text-xs text-slate-700">•</span>
            <span className="text-xs text-slate-600">پتروشیمی</span>
            <span className="text-xs text-slate-700">•</span>
            <span className="text-xs text-slate-600">هوش مصنوعی</span>
            <span className="text-xs text-slate-700">•</span>
            <span className="text-xs text-slate-600">بهینه‌سازی انرژی</span>
            <span className="text-xs text-slate-700">•</span>
            <span className="text-xs text-slate-600">آنالیز داده</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
