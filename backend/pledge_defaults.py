"""Default multilingual Integrity Pledge text.

Used as the seed content the first time the server runs (before an operator has
saved anything from the admin panel). Once saved to the config table the stored
values take over. Priority/rotation order on the display wall is Tamil → Hindi →
English.
"""

DEFAULT_DURATION_SECONDS = 90

PLEDGE_TAMIL = """நேர்மை உறுதிமொழி

நமது நாட்டின் பொருளாதார வளர்ச்சிக்கும், அரசியல் வளர்ச்சிக்கும், சமூக வளர்ச்சிக்கும் ஊழல் ஒரு பெரும் தடையாக உள்ளது என்பதை நான் நம்புகிறேன். இதற்குத் தீர்வுகாண, அரசு, தனியார்துறை மற்றும் பொதுமக்கள் என அனைத்துத் தரப்பினரும் இணைந்து ஊழலை முற்றிலும் ஒழிக்க முயற்சிகளை மேற்கொள்ள வேண்டும் என்பதையும் நான் உறுதியாக நம்புகிறேன்.

ஒவ்வொரு குடிமகனும், எந்நேரமும் விழிப்புடன் இருப்பதுடன், எப்போதும் உறுதிமிக்க நேர்மையுடனும், அதிகபட்ச நாணயத்துடனும், நடந்து கொள்வதன் மூலம், ஊழலுக்கு எதிரான போரில் தங்கள் பங்களிப்பினை வழங்க முடியும் என்பதை நான் நன்கு உணர்கிறேன்.

எனவே நான் கீழ்கண்ட உறுதிமொழிகளை உளமாற எடுத்துக் கொள்கிறேன்:

• எனது அன்றாட வாழ்க்கையில், நேர்மையான வழியிலிருந்து விலகாது, அனைத்து செயல்களையும் சட்டப்படி செய்வேன்.
• நான் லஞ்சம் வாங்கவும் மாட்டேன், கொடுக்கவும் மாட்டேன்.
• எனது செயல்பாடுகள் அனைத்தையும் நேர்மையாகவும், முற்றிலும் வெளிப்படைத் தன்மையுடனும் நிறைவேற்றுவேன்.
• எனது செயல்கள் அனைத்தையும், பொதுமக்களின் நலனை முன்னிறுத்தியே மேற்கொள்வேன்.
• எனது தனிப்பட்ட வாழ்க்கையிலும் நேர்மைக்கு இலக்கணமாகத் திகழ்ந்து அனைவருக்கும் முன்மாதிரியாகத் திகழ்வேன்.
• ஊழல் அல்லது லஞ்சம் தொடர்பான தகவல்கள் எனக்கு தெரியவந்தால், அதுகுறித்து நடவடிக்கை எடுக்க, சம்பந்தப்பட்ட அமைப்புகளிடம் தெரிவிப்பேன்."""

PLEDGE_HINDI = """सत्यनिष्ठा प्रतिज्ञा

मेरा विश्वास है कि हमारे देश की आर्थिक, राजनीतिक तथा सामाजिक प्रगति में भ्रष्टाचार एक बड़ी बाधा है। मेरा विश्वास है कि भ्रष्टाचार का उन्मूलन करने के लिए सभी संबंधित पक्षों जैसे सरकार, नागरिकों तथा निजी क्षेत्र को एक साथ मिल कर कार्य करने की आवश्यकता है।

मेरा मानना है कि प्रत्येक नागरिक को सतर्क होना चाहिए तथा उसे सदैव ईमानदारी तथा सत्यनिष्ठा के उच्चतम मानकों के प्रति वचनबद्ध होना चाहिए तथा भ्रष्टाचार के विरुद्ध संघर्ष में साथ देना चाहिए।

अतः मैं प्रतिज्ञा करता हूँ कि:-

• जीवन के सभी क्षेत्रों में ईमानदारी तथा कानून के नियमों का पालन करूँगा।
• ना तो रिश्वत लूँगा और ना ही रिश्वत दूँगा।
• सभी कार्य ईमानदारी तथा पारदर्शी रीति से करूँगा।
• जनहित में कार्य करूँगा।
• अपने निजी आचरण में ईमानदारी दिखाकर उदाहरण प्रस्तुत करूँगा।
• भ्रष्टाचार की किसी भी घटना की रिपोर्ट उचित एजेंसी को दूँगा।"""

PLEDGE_ENGLISH = """Integrity Pledge

I believe that corruption has been one of the major obstacles to economic, political and social progress of our country. I believe that all stakeholders such as Government, citizens and private sector need to work together to eradicate corruption.

I realise that every citizen should be vigilant and commit to highest standards of honesty and integrity at all times and support the fight against corruption.

I therefore, pledge:

• To follow probity and rule of law in all walks of life.
• To neither take nor offer bribe.
• To perform all tasks in an honest and transparent manner.
• To act in public interest.
• To lead by example exhibiting integrity in personal behaviour.
• To report any incident of corruption to the appropriate agency."""

DEFAULT_PLEDGE_CONFIG = {
    "tamil": PLEDGE_TAMIL,
    "hindi": PLEDGE_HINDI,
    "english": PLEDGE_ENGLISH,
    "duration_seconds": DEFAULT_DURATION_SECONDS,
}
