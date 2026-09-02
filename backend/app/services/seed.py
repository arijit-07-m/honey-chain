"""Seed the database with realistic demo data for the Honey Chain prototype."""
import logging
from datetime import datetime, timedelta
from random import Random, uniform, choice
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User, UserRole
from app.models.cluster import Cluster
from app.models.hive import Hive, HiveStatus
from app.models.sensor_reading import SensorReading
from app.models.batch import Batch
from app.models.traceability_event import TraceabilityEvent
from app.models.alert import Alert
from app.services.auth import hash_password
from app.blockchain.service import create_event, verify_chain

logger = logging.getLogger(__name__)
rng = Random(42)


async def seed_database(db: AsyncSession):
    """Seed database with demo data if it's empty."""
    result = await db.execute(select(func.count(User.id)))
    if result.scalar() > 0:
        logger.info("Database already seeded, skipping")
        return
    cluster_data = [
        ("Kanpur", "Uttar Pradesh"),
        ("Lucknow", "Uttar Pradesh"),
        ("Prayagraj", "Uttar Pradesh"),
        ("Varanasi", "Uttar Pradesh"),
        ("Agra", "Uttar Pradesh"),
    ]
    clusters = []
    for name, location in cluster_data:
        c = Cluster(name=name, location=location)
        db.add(c)
        clusters.append(c)
    await db.flush()

    # ── Users (1 admin + 20 farmers) ──────────────────────────────────────
    admin = User(
        name="Admin KVIC",
        email="admin@honeychain.in",
        password_hash=hash_password("admin123"),
        role=UserRole.ADMIN,
    )
    db.add(admin)
    await db.flush()

    farmer_names = [
        "Rajesh Kumar", "Amit Singh", "Sunita Devi", "Prakash Verma",
        "Rekha Sharma", "Manoj Yadav", "Geeta Patel", "Vijay Pandey",
        "Anita Gupta", "Suresh Tiwari", "Kavita Mishra", "Ravi Shukla",
        "Neha Dubey", "Dinesh Saxena", "Pushpa Rai", "Sanjay Tripathi",
        "Laxmi Chauhan", "Arun Katiyar", "Priya Agarwal", "Vikram Jaiswal",
    ]
    farmers = []
    for i, name in enumerate(farmer_names, 1):
        f = User(
            name=name,
            email=f"farmer{i:02d}@honeychain.in",
            password_hash=hash_password("farmer123"),
            role=UserRole.FARMER,
        )
        db.add(f)
        farmers.append(f)
    await db.flush()
    hive_codes = [f"H{i:03d}" for i in range(1, 31)]
    hives = []
    for i, code in enumerate(hive_codes):
        farmer = farmers[i % len(farmers)]
        cluster = clusters[i % len(clusters)]
        h = Hive(
            hive_code=code,
            cluster_id=cluster.id,
            farmer_id=farmer.id,
            status=HiveStatus.HEALTHY if i != 1 else HiveStatus.ATTENTION,
        )
        db.add(h)
        hives.append(h)
# ── Sensor readings (48h of historical data, one reading/15min) ──────
    await db.flush()
    now = datetime.utcnow()
    base_time = now - timedelta(hours=48)
    for hive in hives:
        for offset in range(0, 48 * 4):
            ts = base_time + timedelta(minutes=15 * offset)
            temp = round(rng.gauss(32.0, 2.5), 1)
            humid = round(rng.gauss(65.0, 6.0), 1)
            wt = round(rng.gauss(26.0, 1.5), 1)
            sound = round(rng.gauss(55.0, 8.0), 1)
            is_anomaly = False
            score = 0.2
            if hive.hive_code == "H002" and offset > 150 and offset % 8 == 0:
                wt = round(uniform(15, 19), 1)
                sound = round(uniform(75, 85), 1)
                is_anomaly = True
                score = 0.8
            reading = SensorReading(
                hive_id=hive.id, temperature=temp, humidity=humid,
                weight=wt, sound_level=sound, timestamp=ts,
                anomaly=is_anomaly, anomaly_score=score,
            )
# ── Alerts ────────────────────────────────────────────────────────────
            db.add(reading)
    hive_h002 = [h for h in hives if h.hive_code == "H002"][0]
    alert = Alert(
        hive_id=hive_h002.id,
        type="ANOMALY",
        message="⚠ Potential hive anomaly detected: unusual weight reading; increased sound activity.",
        severity="WARNING",
    )
    db.add(alert)
    await db.flush()
# ── Batches + traceability events (10 batches) ───────────────────────
    honey_types = ["Mustard Honey", "Litchi Honey", "Eucalyptus Honey",
                   "Acacia Honey", "Multiflora Honey", "Sesame Honey",
                   "Sunflower Honey", "Neem Honey", "Ajwain Honey", "Ber Honey"]

    for i in range(10):
        hive = hives[i % len(hives)]
        farmer = farmers[i % len(farmers)]
        honey_type = honey_types[i]
        qty = round(uniform(5.0, 25.0), 1)
        harvest_date = now - timedelta(days=i * 2 - 5)

        batch = Batch(
            batch_code=f"HC-{now.year}-{i+1:05d}",
            hive_id=hive.id, farmer_id=farmer.id, honey_type=honey_type,
            quantity=qty, harvest_date=harvest_date,
            status="HARVEST" if i < 3 else ("PROCESSING" if i < 6 else "PACKAGING"),
        )
        db.add(batch)
        await db.flush()

        await create_event(
            db=db, batch_id=batch.id, stage="HARVEST",
            actor_id=farmer.id,
            event_data=f"Harvested {qty}kg of {honey_type}",
        )

        if i >= 3:
            await create_event(
                db=db, batch_id=batch.id, stage="PROCESSING",
                actor_id=admin.id,
                event_data="Honey extracted, filtered, and tested for quality",
            )

        if i >= 6:
            await create_event(
                db=db, batch_id=batch.id, stage="PACKAGING",
                actor_id=admin.id,
                event_data="Packed in airtight containers, labelled, and sealed",
            )

    logger.info("Database seeded successfully with demo data")
    logger.info("Seeding database...")
